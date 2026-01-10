import React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonthSelectorProps {
  value: string; // format: YYYY-MM
  onChange: (month: string) => void;
  userCreatedAt?: string; // ISO date string when user created account
  className?: string;
}

function getMonthOptions(userCreatedAt?: string) {
  const options: { label: string; value: string; isCurrent: boolean }[] = [];
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // Determine start date: user creation date or 6 months ago (whichever is more recent)
  let startDate: Date;
  if (userCreatedAt) {
    const creationDate = new Date(userCreatedAt);
    startDate = new Date(creationDate.getFullYear(), creationDate.getMonth(), 1);
  } else {
    // Fallback: 6 months ago if no creation date
    startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  }
  
  // End date: current month
  const endDate = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Generate months from start to current
  for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });
    const isCurrent = value === currentMonth;
    
    options.push({ label, value, isCurrent });
  }
  
  return options.reverse(); // Show recent months first
}

const MonthSelector: React.FC<MonthSelectorProps> = ({ value, onChange, userCreatedAt, className }) => {
  const options = getMonthOptions(userCreatedAt);
  const selectedOption = options.find(opt => opt.value === value);
  
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label className="text-xs font-medium text-gray-700 flex items-center gap-1">
        <Calendar className="h-3 w-3" />
        Select Month
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="appearance-none w-full bg-white border-2 border-blue-300 rounded-lg px-4 py-3 pr-10 text-sm font-medium text-gray-900 shadow-sm hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-all duration-200 cursor-pointer"
          aria-label="Select month for analytics"
        >
          {options.map(opt => (
            <option 
              key={opt.value} 
              value={opt.value}
              className={cn(
                "py-2",
                opt.isCurrent && "font-bold"
              )}
            >
              {opt.label}
              {opt.isCurrent && " (Current)"}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
      </div>
    </div>
  );
};

export default MonthSelector;
