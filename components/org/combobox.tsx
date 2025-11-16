"use client";

import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const roles = [
  {
    value: "owner",
    label: "Owner",
  },
  {
    value: "admin",
    label: "Admin",
  },
  {
    value: "member",
    label: "Member",
  },
] as const;

export type Role = (typeof roles)[number]["value"];

interface RoleComboboxProps {
  value?: string;
  onValueChange?: (value: Role) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function RoleCombobox({
  value,
  onValueChange,
  disabled = false,
  placeholder = "Select role...",
  className,
}: RoleComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selectedRole = roles.find((role) => role.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-[140px] justify-between", className)}
        >
          {selectedRole ? selectedRole.label : placeholder}
          <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[140px] p-0">
        <Command>
          <CommandInput placeholder="Search role..." />
          <CommandList>
            <CommandEmpty>No role found.</CommandEmpty>
            <CommandGroup>
              {roles.map((role) => (
                <CommandItem
                  key={role.value}
                  value={role.value}
                  onSelect={(currentValue) => {
                    const selectedRole = roles.find(
                      (r) => r.value === currentValue,
                    );
                    if (selectedRole && onValueChange) {
                      onValueChange(selectedRole.value);
                    }
                    setOpen(false);
                  }}
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === role.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {role.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
