"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const STORAGE_KEY = "prompt-builder-studio:onboarding-dismissed";

export function OnboardingDialog({
  openFromHelp,
  onClose,
}: {
  openFromHelp?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = window.localStorage.getItem(STORAGE_KEY) === "1";
    const isAutomation = (navigator as any).webdriver === true;
    if (!dismissed && !openFromHelp && !isAutomation) setOpen(true);
  }, [openFromHelp]);

  useEffect(() => {
    if (openFromHelp) setOpen(true);
  }, [openFromHelp]);

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  const handleDontShow = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? handleClose() : setOpen(v))}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Welcome to Prompt Builder Studio</DialogTitle>
          <DialogDescription>Build flows visually, then preview and export.</DialogDescription>
        </DialogHeader>
        <ul className="list-disc pl-5 space-y-2 text-sm">
          <li>Pick a flow in the header (e.g., Deep Research).</li>
          <li>Drag blocks from the left onto the canvas to add steps.</li>
          <li>Connect nodes with handles to define the order.</li>
          <li>Use the inspector on the right to fill parameters.</li>
          <li>Click Run (Preview) to see outputs and guidance.</li>
          <li>Use Flow (Save/Load) to export/import snapshots.</li>
        </ul>
        <Separator />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleDontShow}>Don’t show again</Button>
          <Button onClick={handleClose}>Got it</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
