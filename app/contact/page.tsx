import { Metadata } from "next";
import ContactPageClient from "./ContactPageClient";

export const metadata: Metadata = {
  title: "NOVA • Contact Us",
  description: "Get in touch with NOVA's support team. We're here to help with any questions or concerns about our freight marketplace platform.",
};

export default function ContactPage() {
  return <ContactPageClient />;
}
