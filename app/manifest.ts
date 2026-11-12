import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "MONEYFLOW JAPAN", short_name: "MoneyFlow", description: "บันทึกรายรับรายจ่ายในญี่ปุ่น", start_url: "/", display: "standalone", background_color: "#f3efe6", theme_color: "#f3efe6", lang: "th", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }] };
}
