
/**
 * @fileoverview Header component for the consultant's dashboard.
 * Includes a title, search input, and buttons for data export actions.
 */
"use client";

import type { FC } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, UploadCloud } from 'lucide-react';

/**
 * Props for the DashboardHeader component.
 */
interface DashboardHeaderProps {
  /** Callback function triggered when the search term changes. */
  onSearch: (term: string) => void;
  /** Callback function to open the export dialog. */
  onOpenExportDialog: () => void;
}

/**
 * Renders the header for the consultant's dashboard.
 * @param {DashboardHeaderProps} props - The component's props.
 */
const DashboardHeader: FC<DashboardHeaderProps> = ({ onSearch, onOpenExportDialog }) => {
  return (
    <div className="mb-6">
      <h1 className="text-3xl font-bold mb-4 text-primary">לוח בקרה ליועצת</h1>
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-grow w-full md:w-auto">
          <Input
            type="search"
            placeholder="חיפוש תינוקות..."
            className="pe-10" // Padding-end for icon space (ps-10 in LTR, pe-10 in RTL)
            onChange={(e) => onSearch(e.target.value)}
          />
          {/* Icon positioned at the end (left in RTL) of the input field */}
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={onOpenExportDialog}>
                <UploadCloud className="me-2 h-4 w-4" />
                ייצוא נתונים
            </Button>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
