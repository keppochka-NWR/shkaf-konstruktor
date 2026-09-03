/* Облако: вход по коду на почту, проекты на сервере вместо localStorage.
   Работает, когда конструктор запущен через server/app.py. Без сервера
   (или без входа) конструктор живёт локально, как раньше. */
(function () {
  "use strict";

  var TOKEN_KEY = "wcToken";
  var EMAIL_KEY = "wcEmail";

  function token() { return localStorage.getItem(TOKEN_KEY) || ""; }

  function call(method, path, body) {
    var opts = { method: method, headers: {} };
    if (token()) opts.headers["Authorization"] = "Bearer " + token();
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    return fetch(path, opts).then(function (r) {
      return r.json().then(function (d) { d._status = r.status; return d; });
    }).catch(function () {
      return { ok: false, error: "network", _status: 0,
               message: "Сервер недоступен: конструктор работает локально." };
    });
  }

  window.cloud = {
    available: null,       // null = не проверяли, false = сервера нет
    email: localStorage.getItem(EMAIL_KEY) || "",

    loggedIn: function () { return !!token() && !!this.email; },

    probe: function () {
      var self = this;
      if (!token()) {
        // сервер есть? проверяем лёгким запросом кода без email - 422 значит жив
        return fetch("/api/auth/request-code", { method: "POST",
          headers: { "Content-Type": "application/json" }, body: "{}" })
          .then(function (r) { self.available = r.status !== 404; return self.available; })
          .catch(function () { self.available = false; return false; });
      }
      return call("GET", "/api/me").then(function (res) {
        self.available = res._status !== 0 && res._status !== 404;
        if (res.ok) { self.email = res.email; localStorage.setItem(EMAIL_KEY, res.email); }
        else if (res._status === 401) self.logout();
        return self.available;
      });
    },

    requestCode: function (email) { return call("POST", "/api/auth/request-code", { email: email }); },

    verify: function (email, code) {
      var self = this;
      return call("POST", "/api/auth/verify", { email: email, code: code }).then(function (res) {
        if (res.ok) {
          localStorage.setItem(TOKEN_KEY, res.token);
          localStorage.setItem(EMAIL_KEY, res.email);
          self.email = res.email;
        }
        return res;
      });
    },

    logout: function () {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(EMAIL_KEY);
      this.email = "";
    },

    list: function () { return call("GET", "/api/projects"); },
    save: function (project) {
      if (!project.cloudId) project.cloudId = "p" + Date.now().toString(36) +
        Math.random().toString(36).slice(2, 8);
      return call("POST", "/api/projects",
        { id: project.cloudId, name: project.name || "Шкаф", data: project });
    },
    load: function (id) { return call("GET", "/api/projects/" + encodeURIComponent(id)); },
    remove: function (id) { return call("DELETE", "/api/projects/" + encodeURIComponent(id)); },
  };
})();
