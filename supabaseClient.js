const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = 'https://ejgyhmlcoezvunxyuoud.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service key instead
const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = supabase;
