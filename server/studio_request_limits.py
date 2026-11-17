"""Bound incoming bodies before JSON/base64 parsing, including chunked uploads."""
import asyncio
from starlette.responses import JSONResponse

class StudioRequestLimits:
    def __init__(self, app, timeout=30, max_active=4):
        self.app, self.timeout, self.max_active = app, timeout, max_active
        self.active = 0

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        async def secured_send(message):
            if message['type'] == 'http.response.start':
                headers = list(message.get('headers', []))
                required = {b'x-content-type-options': b'nosniff', b'x-frame-options': b'SAMEORIGIN',
                            b'referrer-policy': b'same-origin', b'permissions-policy': b'camera=(), microphone=(), geolocation=()'}
                present = {k.lower() for k, v in headers}
                headers.extend((k, v) for k, v in required.items() if k not in present)
                message = {**message, 'headers': headers}
            await send(message)
        async def reject(status, text):
            await JSONResponse({'detail': text}, status_code=status, headers={'Cache-Control': 'no-store'})(scope, receive, secured_send)
        if scope['method'] not in ('POST', 'PUT', 'PATCH', 'DELETE'):
            return await self.app(scope, receive, secured_send)
        path = scope['path'].rstrip('/')
        limit = 24 * 1024 * 1024 if path == '/api/studio/projects' else 18 * 1024 * 1024 if path == '/api/studio/assistant' else 2 * 1024 * 1024 if path == '/api/studio/library' else 64 * 1024
        lengths = [v for k, v in scope.get('headers', []) if k.lower() == b'content-length']
        encodings = [v.lower() for k, v in scope.get('headers', []) if k.lower() == b'content-encoding']
        if any(v != b'identity' for v in encodings):
            return await reject(415, 'Сжатые запросы не поддерживаются.')
        if len(lengths) > 1 or lengths and (not lengths[0].isdigit() or len(lengths[0]) > 12):
            return await reject(400, 'Некорректный размер запроса.')
        expected = int(lengths[0]) if lengths else None
        if expected is not None and expected > limit:
            return await reject(413, 'Запрос слишком большой. Уменьшите размер загрузки.')
        if self.active >= self.max_active:
            return await reject(429, 'Сервер занят. Повторите запрос немного позже.')
        self.active += 1
        try:
            chunks, size = [], 0
            async def read():
                nonlocal size
                while True:
                    message = await receive()
                    if message['type'] == 'http.disconnect':
                        return False
                    chunk = message.get('body', b'')
                    size += len(chunk)
                    if size > limit:
                        return 413
                    chunks.append(chunk)
                    if not message.get('more_body', False):
                        return True
            try:
                result = await asyncio.wait_for(read(), self.timeout)
            except asyncio.TimeoutError:
                return await reject(408, 'Превышено время загрузки запроса.')
            if result is False:
                return
            if result == 413:
                return await reject(413, 'Запрос слишком большой. Уменьшите размер загрузки.')
            if expected is not None and expected != size:
                return await reject(400, 'Размер запроса не совпадает с указанным.')
            body = b''.join(chunks)
            chunks.clear()
            delivered = False
            async def replay():
                nonlocal delivered, body
                if not delivered:
                    delivered = True
                    message = {'type': 'http.request', 'body': body, 'more_body': False}
                    body = b''
                    return message
                return await receive()
            await self.app(scope, replay, secured_send)
        finally:
            self.active -= 1
