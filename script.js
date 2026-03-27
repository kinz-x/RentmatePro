import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { DataTable } from "@/components/DataTable";
import { FormModal } from "@/components/FormModal";
import { FormField, FormInput, FormSelect } from "@/components/FormField";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Users,
  DollarSign,
  Wrench,
  Eye,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Mock data
const tenants = [
  { id: 1, name: "Sarah Johnson", unit: "Apt 101", rent: "$1,200", status: "Active", due: "Mar 1" },
  { id: 2, name: "Michael Chen", unit: "Apt 205", rent: "$1,450", status: "Active", due: "Mar 1" },
  { id: 3, name: "Emily Davis", unit: "Apt 312", rent: "$980", status: "Late", due: "Feb 15" },
  { id: 4, name: "James Wilson", unit: "Apt 108", rent: "$1,100", status: "Active", due: "Mar 1" },
  { id: 5, name: "Ana Martinez", unit: "Apt 420", rent: "$1,350", status: "Notice", due: "Apr 1" },
];

const payments = [
  { id: 1, tenant: "Sarah Johnson", amount: "$1,200", date: "Mar 1, 2026", method: "ACH", status: "Completed" },
  { id: 2, tenant: "Michael Chen", amount: "$1,450", date: "Mar 1, 2026", method: "Credit Card", status: "Completed" },
  { id: 3, tenant: "Emily Davis", amount: "$980", date: "Feb 15, 2026", method: "Check", status: "Pending" },
  { id: 4, tenant: "James Wilson", amount: "$1,100", date: "Mar 1, 2026", method: "ACH", status: "Completed" },
];

const StatusBadge = ({ status }: { status: string }) => {
  const variants: Record<string, string> = {
    Active: "bg-success/10 text-success border-success/20",
    Completed: "bg-success/10 text-success border-success/20",
    Late: "bg-destructive/10 text-destructive border-destructive/20",
    Pending: "bg-warning/10 text-warning border-warning/20",
    Notice: "bg-warning/10 text-warning border-warning/20",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full border ${variants[status] || ""}`}>
      {status === "Active" || status === "Completed" ? <CheckCircle2 className="h-3 w-3" /> : null}
      {status === "Pending" || status === "Notice" ? <Clock className="h-3 w-3" /> : null}
      {status === "Late" ? <AlertCircle className="h-3 w-3" /> : null}
      {status}
    </span>
  );
};

const Index = () => {
  const [tenantModal, setTenantModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);

  const tenantColumns = [
    { key: "name", header: "Name" },
    { key: "unit", header: "Unit" },
    { key: "rent", header: "Rent" },
    {
      key: "status",
      header: "Status",
      render: (t: typeof tenants[0]) => <StatusBadge status={t.status} />,
    },
    { key: "due", header: "Due Date" },
  ];

  const paymentColumns = [
    { key: "tenant", header: "Tenant" },
    { key: "amount", header: "Amount" },
    { key: "date", header: "Date" },
    { key: "method", header: "Method" },
    {
      key: "status",
      header: "Status",
      render: (p: typeof payments[0]) => <StatusBadge status={p.status} />,
    },
  ];

  const tableActions = () => (
    <>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
        <Eye className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
  );

  return (
    <DashboardLayout onAddTenant={() => setTenantModal(true)} onAddPayment={() => setPaymentModal(true)}>
      {/* Page Title */}
      <div className="mb-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Welcome back! Here's your property overview.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Properties"
          value="24"
          icon={Building2}
          trend={{ value: "+2", positive: true }}
          delay={0}
        />
        <StatCard
          title="Active Tenants"
          value="89"
          icon={Users}
          trend={{ value: "+5", positive: true }}
          delay={50}
        />
        <StatCard
          title="Monthly Revenue"
          value="$94,200"
          icon={DollarSign}
          trend={{ value: "+12%", positive: true }}
          delay={100}
        />
        <StatCard
          title="Open Requests"
          value="7"
          icon={Wrench}
          trend={{ value: "-3", positive: true }}
          delay={150}
        />
      </div>

      {/* Tables */}
      <div className="space-y-6">
        <DataTable
          title="Recent Tenants"
          columns={tenantColumns}
          data={tenants}
          actions={tableActions}
          searchPlaceholder="Search tenants..."
        />
        <DataTable
          title="Recent Payments"
          columns={paymentColumns}
          data={payments}
          actions={tableActions}
          searchPlaceholder="Search payments..."
        />
      </div>

      {/* Add Tenant Modal */}
      <FormModal
        open={tenantModal}
        onClose={() => setTenantModal(false)}
        title="Add New Tenant"
        onSubmit={() => setTenantModal(false)}
      >
        <FormField label="Full Name">
          <FormInput placeholder="e.g. John Smith" />
        </FormField>
        <FormField label="Email">
          <FormInput type="email" placeholder="john@example.com" />
        </FormField>
        <FormField label="Phone">
          <FormInput type="tel" placeholder="(555) 000-0000" />
        </FormField>
        <FormField label="Unit">
          <FormSelect>
            <option value="">Select a unit...</option>
            <option value="101">Apt 101</option>
            <option value="205">Apt 205</option>
            <option value="312">Apt 312</option>
          </FormSelect>
        </FormField>
        <FormField label="Monthly Rent">
          <FormInput type="text" placeholder="$0.00" />
        </FormField>
      </FormModal>

      {/* Add Payment Modal */}
      <FormModal
        open={paymentModal}
        onClose={() => setPaymentModal(false)}
        title="Record Payment"
        onSubmit={() => setPaymentModal(false)}
        submitLabel="Record Payment"
      >
        <FormField label="Tenant">
          <FormSelect>
            <option value="">Select tenant...</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name} — {t.unit}</option>
            ))}
          </FormSelect>
        </FormField>
        <FormField label="Amount">
          <FormInput type="text" placeholder="$0.00" />
        </FormField>
        <FormField label="Payment Method">
          <FormSelect>
            <option value="">Select method...</option>
            <option value="ach">ACH Transfer</option>
            <option value="card">Credit Card</option>
            <option value="check">Check</option>
            <option value="cash">Cash</option>
          </FormSelect>
        </FormField>
        <FormField label="Date">
          <FormInput type="date" />
        </FormField>
      </FormModal>
    </DashboardLayout>
  );
};

export default Index;
