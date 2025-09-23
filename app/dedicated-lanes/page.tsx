import { requireSignedIn } from "@/lib/auth";

export const metadata = { title: "NOVA • Dedicated Opportunities" };

// Mock data for demonstration
const opportunities = [
  {
    id: 1,
    status: "active",
    reference: "DED-12345",
    title: "Midwest Regional Dry Van Fleet",
    description: "5+ trucks needed • Long-term contract",
    rate: "$8,500/truck",
    rateDescription: "Monthly guaranteed",
    primaryLanes: "Chicago → Detroit → Indianapolis",
    laneDescription: "Regional Midwest routes",
    contractLength: "12 months",
    contractDescription: "Renewable option",
    client: "Midwest Manufacturing Co.",
    clientDescription: "Established 1985",
    requirements: [
      "ELD compliance required",
      "2 years experience minimum",
      "Clean safety record"
    ],
    benefits: [
      "Guaranteed weekly miles",
      "Fuel surcharge included",
      "Quick pay available"
    ],
    timeInfo: "Applications open for 2 more weeks",
    timeIcon: "clock",
    timeColor: "green-500"
  },
  {
    id: 2,
    status: "upcoming",
    reference: "DED-12346",
    title: "West Coast Reefer Fleet",
    description: "10+ trucks needed • Seasonal contract",
    rate: "$9,200/truck",
    rateDescription: "Starts next month",
    primaryLanes: "California → Washington → Oregon",
    laneDescription: "West Coast regional",
    contractLength: "6 months",
    contractDescription: "Seasonal produce",
    client: "Fresh Harvest Distributors",
    clientDescription: "Organic produce specialist",
    requirements: [
      "Reefer experience required",
      "Temperature control certification",
      "Flexible scheduling"
    ],
    benefits: [
      "Premium rates for quality service",
      "Weekly home time",
      "Fuel and maintenance program"
    ],
    timeInfo: "Applications open next week",
    timeIcon: "calendar",
    timeColor: "blue-500"
  },
  {
    id: 3,
    status: "completed",
    reference: "DED-12344",
    title: "Southeast Flatbed Fleet",
    description: "3+ trucks needed • Construction materials",
    rate: "$7,800/truck",
    rateDescription: "Contract fulfilled",
    primaryLanes: "Atlanta → Miami → Charlotte",
    laneDescription: "Southeast triangle",
    contractLength: "8 months",
    contractDescription: "Successfully completed",
    client: "Southeast Builders Supply",
    clientDescription: "Commercial construction",
    requirements: [
      "99.8% on-time delivery",
      "Zero safety incidents",
      "Excellent client feedback"
    ],
    benefits: [
      "Contract renewal offered",
      "Bonus payments received",
      "Preferred carrier status"
    ],
    timeInfo: "Successfully completed October 2023",
    timeIcon: "check-circle",
    timeColor: "green-500"
  }
];

export default async function DedicatedLanesPage() {
  await requireSignedIn();

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8" data-aos="fade-up">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Dedicated Opportunities</h1>
        <p className="text-gray-600">Explore long-term dedicated fleet partnerships</p>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-8" data-aos="fade-up">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
            <select className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
              <option>All Regions</option>
              <option>Northeast</option>
              <option>Southeast</option>
              <option>Midwest</option>
              <option>West Coast</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipment</label>
            <select className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
              <option>All Equipment</option>
              <option>Dry Van</option>
              <option>Reefer</option>
              <option>Flatbed</option>
              <option>Power Only</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fleet Size</label>
            <select className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
              <option>Any Size</option>
              <option>1-5 Trucks</option>
              <option>6-10 Trucks</option>
              <option>11-25 Trucks</option>
              <option>25+ Trucks</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md flex items-center justify-center">
              <i data-feather="filter" className="mr-2"></i> Filter Opportunities
            </button>
          </div>
        </div>
      </div>

      {/* Opportunities Grid */}
      <div className="grid grid-cols-1 gap-6">
        {opportunities.map((opp, index) => (
          <div key={opp.id} className="bg-white rounded-xl p-6 opportunity-card shadow-sm border border-gray-100" data-aos="fade-up" data-aos-delay={index * 100}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center mb-2">
                  <span className={`status-${opp.status} px-3 py-1 rounded-full text-xs font-medium`}>
                    {opp.status.charAt(0).toUpperCase() + opp.status.slice(1)}
                  </span>
                  <span className="text-sm text-gray-500 ml-3">{opp.reference}</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-800">{opp.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{opp.description}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-gray-900">{opp.rate}</p>
                <p className="text-sm text-gray-500">{opp.rateDescription}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Primary Lanes</p>
                <p className="text-sm text-gray-600">{opp.primaryLanes}</p>
                <p className="text-xs text-gray-500">{opp.laneDescription}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Contract Length</p>
                <p className="text-sm text-gray-600">{opp.contractLength}</p>
                <p className="text-xs text-gray-500">{opp.contractDescription}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Client</p>
                <p className="text-sm text-gray-600">{opp.client}</p>
                <p className="text-xs text-gray-500">{opp.clientDescription}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {opp.status === "completed" ? "Performance" : "Requirements"}
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  {opp.requirements.map((req, idx) => (
                    <li key={idx} className="flex items-center">
                      <i data-feather={opp.status === "completed" ? "check-circle" : "check"} className={`w-4 h-4 text-green-500 mr-2`}></i>
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {opp.status === "completed" ? "Outcome" : "Benefits"}
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  {opp.benefits.map((benefit, idx) => (
                    <li key={idx} className="flex items-center">
                      <i data-feather={opp.status === "completed" ? "award" : "star"} className={`w-4 h-4 text-yellow-500 mr-2`}></i>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-gray-100">
              <div className="flex items-center">
                <i data-feather={opp.timeIcon} className={`w-4 h-4 text-${opp.timeColor} mr-2`}></i>
                <span className="text-sm text-gray-500">{opp.timeInfo}</span>
              </div>
              <div className="flex space-x-2">
                <button className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                  View Details
                </button>
                {opp.status === "active" ? (
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
                    Apply Now
                  </button>
                ) : opp.status === "upcoming" ? (
                  <button className="px-4 py-2 bg-gray-200 text-gray-600 rounded-md text-sm font-medium cursor-not-allowed" disabled>
                    Apply Soon
                  </button>
                ) : (
                  <button className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700">
                    Renew Contract
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
