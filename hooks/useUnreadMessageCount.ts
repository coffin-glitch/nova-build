"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useUnreadMessageCount() {
  const { data: chatMessagesData } = useSWR(
    "/api/admin/all-chat-messages",
    fetcher,
    { refreshInterval: 5000 }
  );

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (chatMessagesData?.data) {
      // Count carrier messages (unread from admin perspective)
      const carrierMessages = chatMessagesData.data.filter((msg: any) => 
        msg.carrier_user_id // All carrier messages are considered "unread" until admin responds
      );
      setUnreadCount(carrierMessages.length);
    }
  }, [chatMessagesData]);

  return unreadCount;
}
