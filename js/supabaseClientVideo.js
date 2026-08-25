import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL_VIDEO, SUPABASE_ANON_KEY_VIDEO } from './supabaseConfigVideo.js';

// Client terpisah khusus untuk project video.
// storageKey diberi nama beda supaya sesi login video tidak
// bentrok/menimpa sesi login foto di localStorage browser yang sama.
export const supabaseVideo = createClient(SUPABASE_URL_VIDEO, SUPABASE_ANON_KEY_VIDEO, {
  auth: {
    storageKey: 'secretroom-video-auth',
  },
});
