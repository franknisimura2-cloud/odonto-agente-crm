import { createClient } from '@supabase/supabase-js'
import { clinicaAtual } from './clinica'

// O banco é o da clínica deste endereço (ver `clinica.ts`). Este arquivo só é
// importado depois de `descobrirClinica()` — o `main.tsx` garante a ordem.
const { supabaseUrl, anonKey } = clinicaAtual()

/** A raiz do projeto Supabase da clínica — é daqui que saem as URLs das funções. */
export const SUPABASE_URL = supabaseUrl

export const supabase = createClient(supabaseUrl, anonKey)
