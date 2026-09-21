"use client";

import { useEffect } from "react";

export function SiteConsoleMessage() {
  useEffect(() => {
    console.log("=====\nhi, i'm nii\nWhat is your story ?\n=====");
  }, []);

  return null;
}
