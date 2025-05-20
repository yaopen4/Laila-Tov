
"use client";

import type { FC } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FileText } from 'lucide-react';

interface DashboardHeaderProps {
  onSearch: (term: string) => void;
}

const DashboardHeader: FC<DashboardHeaderProps> = ({ onSearch }) => {
  return (
    <div className="mb-6">
      <h1 className="text-3xl font-bold mb-4 text-primary">לוח בקרה למאמן/ת</h1>
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-grow w-full md:w-auto">
          <Input
            type="search"
            placeholder="חיפוש תינוקות..."
            className="pe-10" // Padding end for search icon
            onChange={(e) => onSearch(e.target.value)}
          />
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        </div>
        {/* Export buttons removed from here */}
      </div>
    </div>
  );
};

export default DashboardHeader;
