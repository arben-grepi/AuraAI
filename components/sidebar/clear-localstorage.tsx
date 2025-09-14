"use client";

import { Button } from "../ui/button";

export function ClearLocalStorage() {
  const clearLocalStorage = () => {
    localStorage.clear();
  };
  return <Button onClick={clearLocalStorage}>Clear Local Storage</Button>;
}
