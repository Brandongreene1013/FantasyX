"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordField(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${props.className || ""} pr-11`} />
      <button type="button" onClick={() => setVisible((value) => !value)}
        className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:text-frost"
        aria-label={visible ? "Hide password" : "Show password"}>
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
