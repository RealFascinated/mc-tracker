import { createContext, useContext, useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";

type SiteHeaderToolbarContextValue = {
  toolbar: ReactNode;
  setToolbar: (toolbar: ReactNode) => void;
  nav: ReactNode;
  setNav: (nav: ReactNode) => void;
};

const SiteHeaderToolbarContext =
  createContext<SiteHeaderToolbarContextValue | null>(null);

function SiteHeaderToolbarProvider({ children }: { children: ReactNode }) {
  const [toolbar, setToolbar] = useState<ReactNode>(null);
  const [nav, setNav] = useState<ReactNode>(null);

  return (
    <SiteHeaderToolbarContext.Provider
      value={{ toolbar, setToolbar, nav, setNav }}
    >
      {children}
    </SiteHeaderToolbarContext.Provider>
  );
}

function useSiteHeaderToolbar() {
  const context = useContext(SiteHeaderToolbarContext);
  if (!context) {
    throw new Error(
      "useSiteHeaderToolbar must be used within SiteHeaderToolbarProvider",
    );
  }
  return context;
}

type SiteHeaderToolbarProps = {
  children: ReactNode;
};

function SiteHeaderToolbar({ children }: SiteHeaderToolbarProps) {
  const { setToolbar } = useSiteHeaderToolbar();

  useLayoutEffect(() => {
    setToolbar(children);
    return () => setToolbar(null);
  }, [children, setToolbar]);

  return null;
}

function SiteHeaderNav({ children }: SiteHeaderToolbarProps) {
  const { setNav } = useSiteHeaderToolbar();

  useLayoutEffect(() => {
    setNav(children);
    return () => setNav(null);
  }, [children, setNav]);

  return null;
}

export {
  SiteHeaderNav,
  SiteHeaderToolbar,
  SiteHeaderToolbarProvider,
  useSiteHeaderToolbar,
};
