import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const trafficData = [
  { name: "YouTube Search", value: 45.2, color: "#3B82F6" },
  { name: "Browse Features", value: 28.4, color: "#8B5CF6" },
  { name: "Suggested Videos", value: 15.6, color: "#F43F5E" },
  { name: "External", value: 7.2, color: "#F59E0B" },
  { name: "Others", value: 3.6, color: "#10B981" }
];

export default function TrafficSourcesCard() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">

      <div className="flex justify-between mb-4">
        <h3 className="font-medium">Traffic Sources</h3>
      </div>

      <div className="flex items-center">

        {/* Donut */}
        <div className="w-1/2 h-[180px]">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={trafficData}
                dataKey="value"
                innerRadius={50}
                outerRadius={80}
              >
                {trafficData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Labels */}
        <div className="w-1/2 space-y-2 text-sm">
          {trafficData.map((item, i) => (
            <div key={i} className="flex justify-between">
              <span>{item.name}</span>
              <span className="font-medium">{item.value}%</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
