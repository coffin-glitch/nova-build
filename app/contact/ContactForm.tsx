'use client';

export default function ContactForm() {
  return (
    <div className="bg-white rounded-xl p-6 contact-card shadow-sm border border-gray-100" data-aos="fade-up">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Send us a message</h2>
      
      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input type="text" id="name" className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Your name" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
            <input type="email" id="email" className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="your.email@example.com" />
          </div>
        </div>
        
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
          <select id="subject" className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
            <option>General Inquiry</option>
            <option>Load Support</option>
            <option>Payment Issue</option>
            <option>Technical Support</option>
            <option>Account Help</option>
            <option>Other</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">Message</label>
          <textarea id="message" rows={5} className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="How can we help you?"></textarea>
        </div>
        
        <div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-md text-sm font-medium">
            Send Message
          </button>
        </div>
      </form>
    </div>
  );
}

