import type {ReactNode} from 'react';
/** Native disclosure: closed initially, keyboard accessible, stays open while fields change. */
export function SettingsSection({title,children}:{title:string;children:ReactNode}) {
 return <details className="property-section settings-section" data-setting={title}><summary>{title}</summary><div className="settings-content">{children}</div></details>;
}
