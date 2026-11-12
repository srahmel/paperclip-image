import { useEffect, useState } from "react";
export function useHostContext() {
  return {
    companyId: "11111111-1111-4111-8111-111111111111",
    companyPrefix: "DEMO",
    entityId: "22222222-2222-4222-8222-222222222222",
    entityType: "issue",
  };
}
export function useHostLocation() {
  const [value, setValue] = useState(() => ({
    search: window.location.search,
  }));
  useEffect(() => {
    const fn = () => setValue({ search: window.location.search });
    window.addEventListener("popstate", fn);
    return () => window.removeEventListener("popstate", fn);
  }, []);
  return value;
}
export function useHostNavigation() {
  const navigate = (to: string) => {
    window.history.pushState(null, "", to);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  return {
    navigate,
    linkProps: (to: string) => ({
      href: to,
      onClick: (event: { preventDefault(): void }) => {
        event.preventDefault();
        navigate(to);
      },
    }),
  };
}
