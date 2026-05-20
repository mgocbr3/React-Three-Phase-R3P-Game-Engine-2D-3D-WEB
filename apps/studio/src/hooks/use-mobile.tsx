import * as React from "react";
import { useInterfaceStore } from "@/stores/interfaceStore";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isNativeMobile, setIsNativeMobile] = React.useState<boolean | undefined>(undefined);
  const interfaceMode = useInterfaceStore((s) => s.interfaceMode);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsNativeMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsNativeMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Manual override or auto-detect
  if (interfaceMode === 'mobile') return true;
  if (interfaceMode === 'desktop') return false;
  return !!isNativeMobile;
}
