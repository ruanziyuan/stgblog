import { createClient } from "@supabase/supabase-js";

// 优先读环境变量，fallback 为默认值（本地开发 & Secrets 未配置时使用）
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://dbtdguasdbmlzpodfeht.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_skyyIapm1MfIpT5R5NcleQ_-reVf604";

export const supabase = createClient(supabaseUrl, supabaseKey);
