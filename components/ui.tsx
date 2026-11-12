import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes } from "react";

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Card({ className = "", ...props }, ref) { return <div ref={ref} className={`card ${className}`} {...props} />; });
export function Button({ className = "", variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) { return <button className={`button button-${variant} ${className}`} {...props} />; }
export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) { return <input className={`input ${className}`} {...props} />; }
export function Select({ className = "", ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) { return <select className={`input ${className}`} {...props} />; }
export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "income" }) { return <span className={`badge badge-${tone}`}>{children}</span>; }
