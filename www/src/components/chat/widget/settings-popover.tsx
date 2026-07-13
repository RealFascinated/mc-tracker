import { SettingsIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ChatDisplayPrefs } from "@/components/chat/lib/types";

type ChatSettingsPopoverProps = {
  prefs: ChatDisplayPrefs;
  onShowToolCallsChange: (show: boolean) => void;
  onShowReasoningChange: (show: boolean) => void;
};

export function ChatSettingsPopover({
  prefs,
  onShowToolCallsChange,
  onShowReasoningChange,
}: ChatSettingsPopoverProps) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Chat settings"
            >
              <SettingsIcon />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          Chat settings
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-56 p-3">
        <p className="mb-3 text-sm font-medium">Display</p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="chat-show-tool-calls" className="text-xs font-normal">
              Tool calls
            </Label>
            <Switch
              id="chat-show-tool-calls"
              size="sm"
              checked={prefs.showToolCalls}
              onCheckedChange={onShowToolCallsChange}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="chat-show-reasoning" className="text-xs font-normal">
              Reasoning
            </Label>
            <Switch
              id="chat-show-reasoning"
              size="sm"
              checked={prefs.showReasoning}
              onCheckedChange={onShowReasoningChange}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
