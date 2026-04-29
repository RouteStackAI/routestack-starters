import { LoaderCircle, Search } from "lucide-react";

export function ActionButton({
  onClick,
  loading,
  disabled,
  icon: Icon,
  children,
}: {
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  icon: typeof Search;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="primary-btn"
      onClick={onClick}
      disabled={disabled}
    >
      {loading ? (
        <LoaderCircle className="size-4 animate-spin" />
      ) : (
        <Icon className="size-4" />
      )}
      {children}
    </button>
  );
}
