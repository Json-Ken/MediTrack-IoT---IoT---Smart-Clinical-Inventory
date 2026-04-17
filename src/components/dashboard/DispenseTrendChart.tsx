import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import { TrendingUp, Activity } from 'lucide-react';
import { DispenseRecord } from '@/types/inventory';
import { format, subDays, startOfDay } from 'date-fns';

interface DispenseTrendChartProps {
  records: DispenseRecord[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card border rounded-xl shadow-lg p-3 min-w-[180px]">
      <p className="font-semibold text-foreground text-sm mb-1">{label}</p>
      <p className="text-xs text-muted-foreground mb-2">{d.fullDate}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Units dispensed:</span>
          <span className="font-semibold text-accent">{d.units}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Transactions:</span>
          <span className="font-medium text-foreground">{d.transactions}</span>
        </div>
      </div>
    </div>
  );
};

export function DispenseTrendChart({ records }: DispenseTrendChartProps) {
  const { data, totalUnits, totalTx, avgPerDay } = useMemo(() => {
    const today = startOfDay(new Date());
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(today, 6 - i);
      return {
        date,
        key: format(date, 'yyyy-MM-dd'),
        label: format(date, 'EEE'),
        fullDate: format(date, 'MMM d, yyyy'),
        units: 0,
        transactions: 0,
      };
    });

    const map = new Map(days.map(d => [d.key, d]));
    records.forEach(r => {
      const key = format(startOfDay(new Date(r.timestamp)), 'yyyy-MM-dd');
      const day = map.get(key);
      if (day) {
        day.units += r.quantity;
        day.transactions += 1;
      }
    });

    const result = Array.from(map.values()).map(d => ({
      name: d.label,
      fullDate: d.fullDate,
      units: d.units,
      transactions: d.transactions,
    }));

    const totalUnits = result.reduce((s, d) => s + d.units, 0);
    const totalTx = result.reduce((s, d) => s + d.transactions, 0);

    return {
      data: result,
      totalUnits,
      totalTx,
      avgPerDay: Math.round(totalUnits / 7),
    };
  }, [records]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="bg-card rounded-2xl border shadow-md p-6"
    >
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">7-Day Dispense Trend</h3>
            <p className="text-sm text-muted-foreground">
              {totalUnits} units • {totalTx} transactions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Avg {avgPerDay}/day</span>
        </div>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="dispenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="name"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Area
              type="monotone"
              dataKey="units"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              fill="url(#dispenseGradient)"
              dot={{ fill: 'hsl(var(--primary))', r: 4 }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
