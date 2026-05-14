import {
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  LoaderCircle,
  Mail,
  MapPin,
  Plane,
  Send,
  Sparkles,
  Ticket,
  User,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import DateRangePicker from "./components/DateRangePicker";
import FlightResultsSection from "./components/FlightResultsSection";
import HotelResultsSection from "./components/HotelResultsSection";
import LookupField from "./components/LookupField";
import type {
  ApprovalRecord,
  DestinationOption,
  LookupOption,
  RoomOption,
  TravelOption,
  TravelRequest,
  TravelType,
} from "./types";
import { formatPrice } from "./types";

const defaultRequest: TravelRequest = {
  employeeName: "",
  employeeEmail: "",
  managerEmail: "",
  purpose: "",
  travelType: "flight",
  origin: "",
  destination: "",
  departDate: "",
  returnDate: "",
  checkInDate: "",
  checkOutDate: "",
  travelers: 1,
  budget: 1200,
};

export default function App() {
  const isApprovePage = window.location.pathname === "/approve";
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token"), []);

  const [request, setRequest] = useState<TravelRequest>(defaultRequest);
  const [options, setOptions] = useState<TravelOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [roomOptions, setRoomOptions] = useState<RoomOption[]>([]);
  const [selectedRoomIndex, setSelectedRoomIndex] = useState<number | null>(null);
  const [preparedOption, setPreparedOption] = useState<TravelOption | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [preparedFlightIndex, setPreparedFlightIndex] = useState<number | null>(null);
  const [preparedRoomId, setPreparedRoomId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [approval, setApproval] = useState<ApprovalRecord | null>(null);

  const [originOptions, setOriginOptions] = useState<LookupOption[]>([]);
  const [destinationOptions, setDestinationOptions] = useState<LookupOption[] | DestinationOption[]>([]);

  const resultsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (options.length > 0 || roomOptions.length > 0) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [options.length, roomOptions.length]);

  const debouncedOrigin = useDebouncedValue(request.origin ?? "", 450);
  const debouncedDestination = useDebouncedValue(request.destination, 450);

  useEffect(() => {
    if (request.travelType !== "flight" || debouncedOrigin.trim().length < 2) {
      setOriginOptions([]);
      return;
    }
    let ignore = false;
    fetch(`/api/lookups/flight?term=${encodeURIComponent(debouncedOrigin)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!ignore) setOriginOptions(Array.isArray(d.options) ? d.options : []);
      })
      .catch(() => {
        if (!ignore) setOriginOptions([]);
      });
    return () => {
      ignore = true;
    };
  }, [debouncedOrigin, request.travelType]);

  useEffect(() => {
    if (debouncedDestination.trim().length < 2) {
      setDestinationOptions([]);
      return;
    }
    const endpoint = request.travelType === "flight"
      ? `/api/lookups/flight?term=${encodeURIComponent(debouncedDestination)}`
      : `/api/lookups/hotel-destination?query=${encodeURIComponent(debouncedDestination)}`;

    let ignore = false;
    fetch(endpoint)
      .then((r) => r.json())
      .then((d) => {
        if (!ignore) setDestinationOptions(Array.isArray(d.options) ? d.options : []);
      })
      .catch(() => {
        if (!ignore) setDestinationOptions([]);
      });
    return () => {
      ignore = true;
    };
  }, [debouncedDestination, request.travelType]);

  useEffect(() => {
    if (!isApprovePage || !token) return;
    fetch(`/api/approvals/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error();
        setApproval(data.record ?? null);
      })
      .catch(() => setStatus("We could not load this approval request."));
  }, [isApprovePage, token]);

  async function searchOptions() {
    setActionKey("search");
    setStatus(
      request.travelType === "flight"
        ? "Searching flight inventory…"
        : "Searching hotels for your dates…",
    );
    setOptions([]);
    setSelectedIndex(null);
    setPreparedOption(null);
    setRoomOptions([]);
    setSelectedRoomIndex(null);
    setPreparedFlightIndex(null);
    setPreparedRoomId(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const data = (await res.json()) as { options?: TravelOption[]; summary?: string };
      if (!res.ok) throw new Error();
      setOptions(data.options ?? []);
      setSelectedIndex(null);
      setStatus(typeof data.summary === "string" ? data.summary : "");
    } catch {
      setStatus("We couldn't find options right now. Please try again.");
    } finally {
      setActionKey(null);
    }
  }

  async function prepareFlight(index: number) {
    const selected = options[index];
    if (!selected) return;
    setSelectedIndex(index);
    setActionKey(`flight-prepare:${index}`);
    setStatus("Revalidating fare and fetching checkout link…");
    try {
      const res = await fetch("/api/flight/prepare-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, selectedOption: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setPreparedOption(data.option);
      setPreparedFlightIndex(index);
      setPreparedRoomId(null);
      setStatus("Flight checkout is ready. You can send for manager approval.");
    } catch {
      setStatus("We couldn't validate this fare. Please try another option.");
    } finally {
      setActionKey(null);
    }
  }

  async function loadHotelRooms(hotelIndex: number) {
    const selected = options[hotelIndex];
    if (!selected) return;
    setSelectedIndex(hotelIndex);
    setActionKey(`hotel-rooms:${hotelIndex}`);
    setStatus("Loading room rates and availability for this hotel…");
    setPreparedOption(null);
    setPreparedRoomId(null);
    try {
      const res = await fetch("/api/hotel/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, selectedOption: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setRoomOptions(data.rooms || []);
      setSelectedRoomIndex(null);
      setStatus("Room options loaded. Revalidate a room to prepare checkout.");
    } catch {
      setStatus("We couldn't load room details. Please try another hotel.");
    } finally {
      setActionKey(null);
    }
  }

  async function prepareHotel(hotelIndex: number, room: RoomOption) {
    const selectedHotel = options[hotelIndex];
    if (!selectedHotel) return;
    const ri = roomOptions.findIndex((r) => r.id === room.id);
    if (ri >= 0) setSelectedRoomIndex(ri);
    setActionKey(`hotel-prepare:${room.id}`);
    setStatus("Revalidating room rate and fetching checkout link…");
    try {
      const res = await fetch("/api/hotel/prepare-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, selectedHotel, selectedRoom: room }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setPreparedOption(data.option);
      setPreparedRoomId(room.id);
      setPreparedFlightIndex(null);
      setStatus("Hotel checkout is ready. You can send for manager approval.");
    } catch {
      setStatus("We couldn't validate this room. Please try another room.");
    } finally {
      setActionKey(null);
    }
  }

  async function submitForApproval() {
    if (!preparedOption) return;
    setActionKey("submit");
    setStatus("Sending approval request to your manager…");
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, selectedOption: preparedOption }),
      });
      if (!res.ok) throw new Error();
      setStatus("Approval request sent successfully.");
    } catch {
      setStatus("We couldn't send the approval email. Please try again.");
    } finally {
      setActionKey(null);
    }
  }

  async function approveRequest() {
    if (!token) return;
    setActionKey("approve");
    setStatus("Completing approval…");
    try {
      const res = await fetch(`/api/approvals/${encodeURIComponent(token)}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error();
      if (data.paymentUrl) window.location.href = data.paymentUrl;
      setStatus("Approved successfully.");
    } catch {
      setStatus("We couldn't complete approval. Please retry.");
    } finally {
      setActionKey(null);
    }
  }

  if (isApprovePage) {
    return (
      <main className="mx-auto mt-8 max-w-2xl px-4">
        <section className="glass rounded-3xl p-6 animate-rise-in">
          <h1 className="text-2xl font-semibold">Manager Approval</h1>
          {!approval && <p className="mt-3 text-slate-300">Loading request...</p>}
          {approval && (
            <div className="mt-5 space-y-3 text-slate-200">
              <p><strong>Employee:</strong> {approval.request.employeeName}</p>
              <p><strong>Purpose:</strong> {approval.request.purpose}</p>
              <p><strong>Selected Option:</strong> {approval.selectedOption.title}</p>
              <p><strong>Price:</strong> {formatPrice(approval.selectedOption.totalPrice, approval.selectedOption.currency)}</p>
              <button className="btn-primary mt-3" onClick={approveRequest} disabled={Boolean(actionKey)}>
                {actionKey === "approve" ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {actionKey === "approve" ? "Approving…" : "Approve & Continue"}
              </button>
            </div>
          )}
          {status && <FriendlyMessage text={status} />}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">
      <header className="mb-5 flex flex-col gap-3 rounded-3xl border border-orange-400/20 bg-orange-400/10 p-5 animate-rise-in">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-orange-200">
          <Sparkles className="size-4" /> RouteStack Corporate Travel
        </div>
        <h1 className="text-2xl font-semibold">Smart Booking Approval Workspace</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <section className="glass rounded-3xl p-4 animate-rise-in">
          <div className="mb-3 text-sm font-semibold text-orange-200">Employee Details</div>
          <div className="grid gap-3">
            <Input label="Employee Name" value={request.employeeName} onChange={(v) => setRequest({ ...request, employeeName: v })} icon={User} />
            <Input label="Employee Email" type="email" value={request.employeeEmail} onChange={(v) => setRequest({ ...request, employeeEmail: v })} icon={Mail} />
            <Input label="Manager Email" type="email" value={request.managerEmail} onChange={(v) => setRequest({ ...request, managerEmail: v })} icon={Mail} />
            <Input label="Business Purpose" value={request.purpose} onChange={(v) => setRequest({ ...request, purpose: v })} icon={Ticket} />
          </div>

          <div className="my-4 h-px bg-white/10" />
          <div className="mb-3 text-sm font-semibold text-orange-200">Travel Details</div>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-200">Travel Type</span>
              <select
                className="field"
                value={request.travelType}
                onChange={(e) => {
                  setOptions([]);
                  setSelectedIndex(null);
                  setPreparedOption(null);
                  setRoomOptions([]);
                  setSelectedRoomIndex(null);
                  setPreparedFlightIndex(null);
                  setPreparedRoomId(null);
                  setRequest({ ...request, travelType: e.target.value as TravelType })}
                }
              >
                <option className="bg-[#161621] text-slate-100" value="flight">
                  Flight
                </option>
                <option className="bg-[#161621] text-slate-100" value="hotel">
                  Hotel
                </option>
              </select>
            </label>

            {request.travelType === "flight" && (
              <LookupField
                label="Origin"
                icon={MapPin}
                value={request.origin ?? ""}
                options={originOptions}
                onChange={(v) => setRequest({ ...request, origin: v })}
                onSelect={(o) => setRequest({ ...request, origin: o.code || o.label })}
              />
            )}

            <LookupField
              label="Destination"
              icon={MapPin}
              value={request.destination}
              options={destinationOptions}
              onChange={(v) => setRequest({ ...request, destination: v })}
              onSelect={(o) => setRequest({ ...request, destination: o.code || o.label })}
            />

            {request.travelType === "flight" ? (
              <DateRangePicker
                label="Travel Dates"
                start={request.departDate}
                end={request.returnDate}
                onChange={(start, end) => setRequest({ ...request, departDate: start, returnDate: end })}
              />
            ) : (
              <DateRangePicker
                label="Stay Dates"
                start={request.checkInDate}
                end={request.checkOutDate}
                onChange={(start, end) => setRequest({ ...request, checkInDate: start, checkOutDate: end })}
              />
            )}

            <Input label="Travelers" type="number" value={String(request.travelers)} onChange={(v) => setRequest({ ...request, travelers: Number(v) || 1 })} icon={Users} />
            <Input label="Budget" type="number" value={String(request.budget)} onChange={(v) => setRequest({ ...request, budget: Number(v) || 0 })} icon={Ticket} />
            <button className="btn-primary" onClick={searchOptions} disabled={Boolean(actionKey)}>
              {actionKey === "search" ? <LoaderCircle className="size-4 animate-spin" /> : request.travelType === "flight" ? <Plane className="size-4" /> : <BedDouble className="size-4" />}
              {actionKey === "search" ? "Searching…" : "Search Options"}
            </button>
          </div>
        </section>

        <section ref={resultsRef} className="glass rounded-3xl p-5 animate-rise-in">
          <h3 className="mb-4 text-base font-semibold text-orange-200">Results</h3>
          <div className="max-h-[min(72vh,860px)] overflow-y-auto pr-2">
            {request.travelType === "flight" ? (
              <FlightResultsSection
                options={options}
                selectedIndex={selectedIndex}
                actionKey={actionKey}
                onPrepareFlight={prepareFlight}
                preparedFlightIndex={preparedFlightIndex}
                searchLoading={actionKey === "search"}
              />
            ) : (
              <HotelResultsSection
                options={options}
                selectedIndex={selectedIndex}
                roomOptions={roomOptions}
                selectedRoomIndex={selectedRoomIndex}
                actionKey={actionKey}
                onLoadRooms={loadHotelRooms}
                onSelectRoom={(index) => {
                  setSelectedRoomIndex(index);
                  setPreparedOption(null);
                }}
                onPrepareHotelRoom={prepareHotel}
                preparedRoomId={preparedRoomId}
                searchLoading={actionKey === "search"}
              />
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3 border-t border-white/10 pt-4">
            <button
              className="btn-primary"
              disabled={Boolean(actionKey) || !preparedOption?.paymentUrl}
              onClick={submitForApproval}
            >
              {actionKey === "submit" ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
              {actionKey === "submit" ? "Sending…" : "Send for manager approval"}
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
            {preparedOption?.paymentUrl ? (
              <span className="inline-flex items-center gap-2 text-emerald-300">
                <CheckCircle2 className="size-4" /> Checkout is ready. Use the button above to email your manager.
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <AlertTriangle className="size-4 text-orange-300" /> Use the actions on a result card to revalidate and prepare checkout before approval.
              </span>
            )}
          </div>
          {status && <FriendlyMessage text={status} />}
        </section>
      </div>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="inline-flex items-center gap-2 font-medium text-slate-200">
        {Icon ? <Icon className="size-4 text-orange-200" /> : null}
        {label}
      </span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="field" />
    </label>
  );
}

function FriendlyMessage({ text }: { text: string }) {
  return <p className="mt-4 rounded-xl border border-orange-300/30 bg-orange-300/10 px-3 py-2 text-sm text-orange-100">{text}</p>;
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
