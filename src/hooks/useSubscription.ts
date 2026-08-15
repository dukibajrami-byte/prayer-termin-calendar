import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { useAuth } from "@/hooks/useAuth";

export interface SubscriptionRow {
  status: string;
  price_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
}

function isActive(row: SubscriptionRow | null) {
  if (!row) return false;
  const end = row.current_period_end ? new Date(row.current_period_end).getTime() : null;
  const future = end === null || end > Date.now();
  if (["active", "trialing", "past_due"].includes(row.status) && future) return true;
  return row.status === "canceled" && end !== null && end > Date.now();
}

export function useSubscription() {
  const { user, loading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [hasGrant, setHasGrant] = useState(false);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setHasGrant(false);
      setLoading(false);
      return;
    }
    const { data: grant } = await supabase
      .from("premium_grants")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    setHasGrant(Boolean(grant));
    const { data } = await supabase
      .from("subscriptions")
      .select("status, price_id, current_period_end, cancel_at_period_end")
      .eq("user_id", user.id)
      .eq("environment", getStripeEnvironment())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSubscription((data as SubscriptionRow | null) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void refetch();
  }, [authLoading, refetch]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`subscriptions-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => void refetch(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, refetch]);

  const isPremium = hasGrant || isActive(subscription);
  const hasActiveSubscription = isActive(subscription);

  return {
    subscription,
    hasGrant,
    hasActiveSubscription,
    isPremium,
    loading: loading || authLoading,
    refetch,
  };
}