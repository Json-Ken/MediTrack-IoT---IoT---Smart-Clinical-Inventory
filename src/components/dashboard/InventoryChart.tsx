import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { Medicine, StockStatus } from '@/types/inventory';
import { TrendingUp, Package, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InventoryChartProps {
  medicines: Medicine[];
}

const statusColors: Record<StockStatus, string> = {
  ok: 'hsl(142, 76%, 36%)',
  low: 'hsl(38, 92%, 50%)',
  critical: 'hsl(0, 84%, 60%)',
  expired: 'hsl(0, 0%, 60%)',
};

type FilterKey = 'all' | StockStatus;

const filters: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ok', label: 'OK' },
  { key: 'low', label: 'Low' },
  { key: 'critical', label: 'Critical' },
  { key: 'expired', label: 'Expired' },
];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const pct = d.reorderLevel > 0 ? Math.round((d.quantity / d.reorderLevel) * 100) : 0;
  return (
    <div className="bg-card border rounded-xl shadow-lg p-3 min-w-[200px]">
      <p className="font-semibold text-foreground text-sm mb-1">{d.fullName}</p>
      <p className="text-xs text-muted-foreground mb-2">{d.category}</p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Stock:</span>
          <span className="font-medium text-foreground">{d.quantity} units</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Reorder at:</span>
          <span className="font-medium text-foreground">{d.reorderLevel} units</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Level:</span>
          <span className="font-medium" style={{ color: statusColors[d.status as StockStatus] }}>
            {pct}% of reorder
          </span>
        </div>
        <div className="flex justify-between gap-4 pt-1 border-t mt-1">
          <span className="text-muted-foreground">Status:</span>
          <span className="font-semibold capitalize" style={{ color: statusColors[d.status as StockStatus] }}>
            {d.status}
          </span>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2 italic">Click bar to view in inventory</p>
    </div>
  );
};

export function InventoryChart({ medicines }: InventoryChartProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const counts = useMemo(() => {
    return medicines.reduce(
      (acc, m) => {
        acc[m.status] = (acc[m.status] || 0) + 1;
        acc.all += 1;
        return acc;
      },
      { all: 0, ok: 0, low: 0, critical: 0, expired: 0 } as Record<FilterKey, number>,
    );
  }, [medicines]);

  const chartData = useMemo(() => {
    const filtered = filter === 'all' ? medicines : medicines.filter(m => m.status === filter);
    return filtered
      .slice()
      .sort((a, b) => b.quantity - a.quantity)
      .map(m => ({
        name: m.name.length > 10 ? m.name.slice(0, 10) + '…' : m.name,
        fullName: m.name,
        category: m.category,
        quantity: m.quantity,
        reorderLevel: m.reorderLevel,
        status: m.status,
        id: m.id,
      }));
  }, [medicines, filter]);

  const avgReorder = chartData.length
    ? Math.round(chartData.reduce((s, d) => s + d.reorderLevel, 0) / chartData.length)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="bg-card rounded-2xl border shadow-md p-6"
    >
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-accent/10">
            <TrendingUp className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Inventory Levels</h3>
            <p className="text-sm text-muted-foreground">
              {chartData.length} {chartData.length === 1 ? 'item' : 'items'}
              {filter !== 'all' && ` • ${filter}`}
            </p>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {filters.map(f => {
          const active = filter === f.key;
          const color = f.key === 'all' ? undefined : statusColors[f.key as StockStatus];
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                active
                  ? 'text-white border-transparent shadow-sm'
                  : 'bg-background text-muted-foreground hover:bg-muted border-border',
              )}
              style={active ? { backgroundColor: color || 'hsl(var(--primary))' } : undefined}
            >
              {f.label} <span className="opacity-70">({counts[f.key]})</span>
            </button>
          );
        })}
      </div>

      <div className="h-[300px]">
        {chartData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Package className="w-10 h-10 opacity-40" />
            <p className="text-sm">No medicines match this filter</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="name"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                angle={-35}
                textAnchor="end"
                height={60}
                interval={0}
              />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} />
              {avgReorder > 0 && (
                <ReferenceLine
                  y={avgReorder}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  label={{
                    value: `Avg reorder: ${avgReorder}`,
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 10,
                    position: 'insideTopRight',
                  }}
                />
              )}
              <Bar
                dataKey="quantity"
                radius={[6, 6, 0, 0]}
                onClick={() => navigate('/inventory')}
                onMouseEnter={(_, idx) => setActiveIndex(idx)}
                cursor="pointer"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={statusColors[entry.status]}
                    fillOpacity={activeIndex === null || activeIndex === index ? 1 : 0.4}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend / Summary */}
      <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          {(Object.keys(statusColors) as StockStatus[]).map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: statusColors[status] }} />
              <span className="text-xs text-muted-foreground capitalize">
                {status} ({counts[status]})
              </span>
            </button>
          ))}
        </div>
        {counts.critical > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-danger">
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="font-medium">{counts.critical} need attention</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
