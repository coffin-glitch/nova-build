import ContactForm from './ContactForm';

export const metadata = { title: "NOVA • Contact Us" };

export default function ContactPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8" data-aos="fade-up">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Contact Us</h1>
        <p className="text-gray-600">Get in touch with our carrier support team</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Contact Form */}
        <div className="lg:col-span-2">
          <ContactForm />
        </div>

        {/* Contact Information */}
        <div className="space-y-6">
          {/* Support Hours */}
          <div className="bg-white rounded-xl p-6 contact-card shadow-sm border border-gray-100" data-aos="fade-up">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Support Hours</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Monday - Friday</span>
                <span className="text-sm font-medium text-gray-800">6:00 AM - 10:00 PM CT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Saturday</span>
                <span className="text-sm font-medium text-gray-800">7:00 AM - 7:00 PM CT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Sunday</span>
                <span className="text-sm font-medium text-gray-800">8:00 AM - 6:00 PM CT</span>
              </div>
            </div>
          </div>

          {/* Contact Methods */}
          <div className="bg-white rounded-xl p-6 contact-card shadow-sm border border-gray-100" data-aos="fade-up">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Get in Touch</h3>
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-4">
                  <i data-feather="phone" className="text-blue-600"></i>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Phone Support</p>
                  <p className="text-sm text-gray-600">(800) 555-1234</p>
                </div>
              </div>
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-4">
                  <i data-feather="mail" className="text-blue-600"></i>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Email</p>
                  <p className="text-sm text-gray-600">support@novabuild.com</p>
                </div>
              </div>
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-4">
                  <i data-feather="message-square" className="text-blue-600"></i>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Live Chat</p>
                  <p className="text-sm text-gray-600">Available during support hours</p>
                </div>
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="bg-orange-50 rounded-xl p-6 border border-orange-200" data-aos="fade-up">
            <div className="flex items-start mb-4">
              <i data-feather="alert-triangle" className="w-6 h-6 text-orange-500 mr-3"></i>
              <h3 className="text-lg font-semibold text-orange-800">Emergency Support</h3>
            </div>
            <p className="text-sm text-orange-700 mb-4">For urgent load issues outside regular hours</p>
            <div className="flex items-center">
              <i data-feather="phone" className="w-5 h-5 text-orange-600 mr-3"></i>
              <span className="text-lg font-bold text-orange-800">(800) 555-EMER</span>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mt-12" data-aos="fade-up">
        <h2 className="text-2xl font-bold text-gray-800 mb-8">Frequently Asked Questions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">How do I update my payment information?</h3>
            <p className="text-gray-600">You can update your payment methods in the Profile section under Payment Settings. All changes are secure and take effect immediately.</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">What if I need to cancel a load?</h3>
            <p className="text-gray-600">Contact our support team as soon as possible. Cancellation policies vary by load, and early notification helps us minimize impacts.</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">How long does payment processing take?</h3>
            <p className="text-gray-600">Most payments are processed within 2-3 business days after load completion. Quick Pay options are available for eligible carriers.</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Can I update my equipment details?</h3>
            <p className="text-gray-600">Yes, you can update your equipment information in your Profile settings. Keeping this current helps us match you with better loads.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
