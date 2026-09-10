import { supabase } from "@/integrations/supabase/client";

export function archivePinStorageKey(userId: string) {
  return `nur-archive-pin:${userId}`;
}

export async function hasJournalPin() {
  const { data, error } = await supabase.rpc("has_journal_pin");
  if (error) throw error;
  return data === true;
}

export async function setJournalPin(pin: string, current?: string) {
  const { error } = await supabase.rpc("set_journal_pin", {
    _pin: pin,
    ...(current ? { _current: current } : {}),
  });
  if (error) throw error;
}

export async function verifyJournalPin(pin: string) {
  const { data, error } = await supabase.rpc("verify_journal_pin", { _pin: pin });
  if (error) throw error;
  return data === true;
}

export async function clearJournalPin(current: string) {
  const { error } = await supabase.rpc("clear_journal_pin", { _current: current });
  if (error) throw error;
}
