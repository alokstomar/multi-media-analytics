import { LineChart, Line, ResponsiveContainer, XAxis, Tooltip, Area } from "recharts";

const subsData = [
  { name: "May 12", subs: 1.6 },
  { name: "May 17", subs: 1.8 },
  { name: "May 22", subs: 1.9 },
  { name: "May 27", subs: 2.0 },
  { name: "Jun 1", subs: 2.05 },
  { name: "Jun 6", subs: 2.1 },
  { name: "Jun 12", subs: 2.2 }
];

export default function SubscribersGrowthCard() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">

      <div className="flex justify-between mb-2">
        <div>
          <h3 className="font-medium">Subscribers Growth</h3>
          <p className="text-sm text-gray-500">
            Total Subscribers: 2.1M <span className="text-green-500">+8.7%</span>
          </p>
        </div>

        <select className="text-sm border rounded-lg px-2 py-1">
          <option>Daily</option>
        </select>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={subsData}>
          <defs>
            <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
            </linearGradient>
          </defs>

          <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip />

          <Line
            type="monotone"
            dataKey="subs"
            stroke="#8B5CF6"
            strokeWidth={3}
            dot={{ r: 4 }}
          />

          <Area
            type="monotone"
            dataKey="subs"
            fill="url(#purpleGradient)"
          />
        </LineChart>
      </ResponsiveContainer>

    </div>
  );
}
