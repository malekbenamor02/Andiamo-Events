import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2 bg-card border border-border rounded-lg shadow-lg", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-2 sm:space-x-2 sm:space-y-0",
        month: "space-y-2",
        caption: "flex justify-center pt-1 relative items-center mb-2",
        caption_label: "text-xs font-semibold text-foreground",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-6 w-6 bg-muted/50 hover:bg-primary/20 border border-border/50 hover:border-primary/50 text-foreground hover:text-primary p-0 transition-all duration-300 hover:scale-110"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-0.5",
        head_row: "flex mb-1",
        head_cell:
          "text-muted-foreground rounded-md w-7 font-medium text-[10px] uppercase tracking-wider",
        row: "flex w-full mt-1",
        cell: "h-7 w-7 text-center text-xs p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/20 [&:has([aria-selected])]:bg-primary/20 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 p-0 font-normal text-xs text-foreground hover:bg-primary/20 hover:text-primary hover:border-primary/50 border border-transparent rounded-md transition-all duration-300 hover:scale-110 aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-gradient-to-br from-primary to-secondary text-white hover:bg-gradient-to-br hover:from-primary hover:to-secondary hover:text-white focus:bg-gradient-to-br focus:from-primary focus:to-secondary focus:text-white border-primary shadow-md shadow-primary/50 font-semibold",
        day_today: "bg-accent/30 text-accent-foreground border-accent/50 font-semibold",
        day_outside:
          "day-outside text-muted-foreground opacity-40 aria-selected:bg-primary/10 aria-selected:text-primary aria-selected:opacity-60",
        day_disabled: "text-muted-foreground opacity-30 cursor-not-allowed",
        day_range_middle:
          "aria-selected:bg-primary/20 aria-selected:text-primary border-primary/30",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-3 w-3" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-3 w-3" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
