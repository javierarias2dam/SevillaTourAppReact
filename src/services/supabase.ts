import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gfmzqxnwgakbibioddot.supabase.co";
const SUPABASE_KEY = "sb_publishable_Xo8iTzf9ZmUJFM_f8Qiwdw_TXHV0-aY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
