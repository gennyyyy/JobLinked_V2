"use client";

import {
  Line,
  LineChart,
  Bar,
  BarChart,
  Pie,
  PieChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/shared";

const activityConfig = {
  applications: { label: "Applications", color: "var(--chart-1)" },
  placements: { label: "Placements", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function EmploymentActivityChart({
  data,
}: {
  data: { month: string; applications: number; placements: number }[];
}) {
  if (!data.length)
    return (
      <EmptyState
        title="No activity in this period."
        description="Try a date range that includes sample applications."
      />
    );
  return (
    <ChartContainer
      config={activityConfig}
      className="h-[260px] min-h-[260px] w-full"
      aria-label="Sample applications and placements over time"
    >
      <LineChart
        accessibilityLayer
        data={data}
        margin={{ left: -24, right: 12, top: 12, bottom: 4 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 5" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={12}
          minTickGap={24}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          type="monotone"
          dataKey="applications"
          stroke="var(--color-applications)"
          strokeWidth={2.5}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="placements"
          stroke="var(--color-placements)"
          strokeWidth={2.5}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

export function BarangayVacancyChart({
  data,
}: {
  data: { name: string; vacancies: number }[];
}) {
  const sorted = [...data]
    .sort((a, b) => b.vacancies - a.vacancies)
    .slice(0, 6);
  const config = {
    vacancies: { label: "Vacancies", color: "var(--chart-1)" },
  } satisfies ChartConfig;
  if (!sorted.some((r) => r.vacancies))
    return (
      <EmptyState
        title="No sample vacancies in this period."
        description="Adjust the report dates to include published vacancies."
      />
    );
  return (
    <ChartContainer
      config={config}
      className="h-[280px] min-h-[280px] w-full"
      aria-label="Top six barangays by sample published vacancies"
    >
      <BarChart
        accessibilityLayer
        data={sorted}
        layout="vertical"
        margin={{ left: 2, right: 24, top: 4, bottom: 4 }}
      >
        <CartesianGrid horizontal={false} strokeDasharray="3 5" />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          dataKey="name"
          type="category"
          tickLine={false}
          axisLine={false}
          width={100}
          tick={{ fontSize: 10 }}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar
          dataKey="vacancies"
          fill="var(--color-vacancies)"
          radius={[0, 5, 5, 0]}
          barSize={20}
          isAnimationActive={false}
        />
      </BarChart>
    </ChartContainer>
  );
}

export function EmploymentTypeChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  const config = Object.fromEntries(
    data.map((item, i) => [
      `type${i}`,
      { label: item.name, color: `var(--chart-${i + 1})` },
    ]),
  ) satisfies ChartConfig;
  const rows = data
    .map((item, i) => ({
      ...item,
      key: `type${i}`,
      fill: `var(--color-type${i})`,
    }))
    .filter((item) => item.value > 0);
  if (!rows.length)
    return (
      <EmptyState
        title="No job-type data for this period."
        description="Only published, approved sample vacancies are counted."
      />
    );
  return (
    <div>
      <ChartContainer
        config={config}
        className="mx-auto h-[210px] min-h-[210px] w-full max-w-xs"
        aria-label="Sample vacancies by employment type"
      >
        <PieChart accessibilityLayer>
          <ChartTooltip content={<ChartTooltipContent nameKey="key" />} />
          <Pie
            data={rows}
            dataKey="value"
            nameKey="key"
            innerRadius={55}
            outerRadius={82}
            paddingAngle={4}
            strokeWidth={0}
            isAnimationActive={false}
          >
            {rows.map((row) => (
              <Cell key={row.key} fill={row.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
        {rows.map((row, index) => (
          <li className="flex items-center justify-between gap-2" key={row.key}>
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="size-2 rounded-sm"
                style={{
                  background: `var(--chart-${data.findIndex((d) => d.name === row.name) + 1})`,
                }}
              />
              {row.name}
            </span>
            <span className="font-medium text-navy">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
