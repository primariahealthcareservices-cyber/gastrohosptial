import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import ComingSoon from './pages/ComingSoon'

import Login from './pages/auth/Login'

import SuperAdminDashboard from './pages/superadmin/Dashboard'
import UserManagement from './pages/superadmin/UserManagement'
import DiscountPermissions from './pages/superadmin/DiscountPermissions'
import DoctorMaster from './pages/superadmin/DoctorMaster'
import PermissionProfiles from './pages/superadmin/PermissionProfiles'
import LabTests from './pages/superadmin/LabTests'
import BulkImport from './pages/superadmin/BulkImport'

import AdminDashboard from './pages/admin/Dashboard'
import AdminBillingManagement from './pages/admin/BillingManagement'

import ExecutiveDashboard from './pages/executive/Dashboard'
import ExecutiveBillingModifications from './pages/executive/BillingModifications'
import OutPatientList from './pages/executive/OutPatientList'
import InPatientList from './pages/executive/InPatientList'
import PatientRecords from './pages/executive/PatientRecords'
import PatientRegistration from './pages/executive/PatientRegistration'
import Appointments from './pages/executive/Appointments'
import Admission from './pages/executive/Admission'
import OPBilling from './pages/executive/OPBilling'
import IPBilling from './pages/executive/IPBilling'
import PatientStatus from './pages/executive/PatientStatus'
import RoomTransferApproval from './pages/executive/RoomTransferApproval'
import RoomOccupation from './pages/executive/RoomOccupation'
import DirectServices from './pages/executive/DirectServices'
import AdvancePayment from './pages/executive/AdvancePayment'
import AdvancePaymentDetail from './pages/executive/AdvancePaymentDetail'
import IPDetails from './pages/executive/IPDetails'
import DischargeSummary from './pages/executive/DischargeSummary'
import OPLabPage from './pages/executive/OPLabPage'
import OPServicesPage from './pages/executive/OPServicesPage'
import OPProceduresPage from './pages/executive/OPProceduresPage'
import PatientOverview from './pages/executive/PatientOverview'

import IPLabReport from './pages/executive/reports/IPLabReport'
import OPLabReport from './pages/executive/reports/OPLabReport'
import IPRadiologyReport from './pages/executive/reports/IPRadiologyReport'
import OPRadiologyReport from './pages/executive/reports/OPRadiologyReport'

import IPLabPage from './pages/executive/IPLabPage'
import IPServicesPage from './pages/executive/IPServicesPage'
import IPProceduresPage from './pages/executive/IPProceduresPage'

import PharmacyLayout from './components/pharmacy/PharmacyLayout'
import PharmacyDashboard from './pages/pharmacy/Dashboard'
import PharmacyComingSoon from './pages/pharmacy/ComingSoon'
import InpatientSales from './pages/pharmacy/InpatientSales'
import OutpatientSales from './pages/pharmacy/OutpatientSales'
import PatientIndents from './pages/pharmacy/PatientIndents'
import OTIndents from './pages/pharmacy/OTIndents'
import GoodsReceiveNote from './pages/pharmacy/GoodsReceiveNote'
import StockAdjustments from './pages/pharmacy/StockAdjustments'
import SupplierMaster from './pages/pharmacy/SupplierMaster'
import InventoryType from './pages/pharmacy/masters/InventoryType'
import ItemType from './pages/pharmacy/masters/ItemType'
import ManufacturerMaster from './pages/pharmacy/ManufacturerMaster'
import PurchaseOrder from './pages/pharmacy/PurchaseOrder'
import ItemStock from './pages/pharmacy/ItemStock'

import LabLayout from './components/lab/LabLayout'
import LabDashboard from './pages/lab/Dashboard'
import OPReports from './pages/lab/OPReports'
import IPReports from './pages/lab/IPReports'
import TestMaster from './pages/lab/TestMaster'

// =========================================================
// ALL PHARMACY REPORTS IMPORTS (Based on your folder)
// =========================================================
import TotalSalesReport from './pages/pharmacy/reports/TotalSalesReport'
import PharmacyDueReceivedReport from './pages/pharmacy/reports/PharmacyDueReceivedReport'
import PharmacyDueReport from './pages/pharmacy/reports/PharmacyDueReport'
import SalesReturns from './pages/pharmacy/reports/SalesReturns'
import OpIpSalesReport from './pages/pharmacy/reports/OpIpSalesReport'
import OpIpDueReport from './pages/pharmacy/reports/OpIpDueReport'
import ScheduleItemReport from './pages/pharmacy/reports/ScheduleItemReport'
import PurchasewiseItemReport from './pages/pharmacy/reports/PurchasewiseItemReport'
import EmployeeSalesReport from './pages/pharmacy/reports/EmployeeSalesReport'
import SalesReport from './pages/pharmacy/reports/SalesReport'
import NewSalesReport from './pages/pharmacy/reports/NewSalesReport'
import ProductWiseSalesReport from './pages/pharmacy/reports/ProductWiseSalesReport'
import GrnReport from './pages/pharmacy/reports/GrnReport'
import GrnAdjustmentReport from './pages/pharmacy/reports/GrnAdjustmentReport'
import ProfitReport from './pages/pharmacy/reports/ProfitReport'
import PurchaseReport from './pages/pharmacy/reports/PurchaseReport'
import StockReturnsReport from './pages/pharmacy/reports/StockReturnsReport'
import SupplierWisePurchaseReport from './pages/pharmacy/reports/SupplierWisePurchaseReport'
import GrnWisePurchaseReport from './pages/pharmacy/reports/GrnWisePurchaseReport'
import OtIndentsReport from './pages/pharmacy/reports/OtIndentsReport'
import DoctorSalesReport from './pages/pharmacy/reports/DoctorSalesReport'
import DoctorWiseItemSalesReport from './pages/pharmacy/reports/DoctorWiseItemSalesReport'
import PatientWiseSaleReport from './pages/pharmacy/reports/PatientWiseSaleReport'
import ItemWiseSaleReport from './pages/pharmacy/reports/ItemWiseSaleReport'
import InvoiceTaxReport from './pages/pharmacy/reports/InvoiceTaxReport'
import PurchasePaymentsReport from './pages/pharmacy/reports/PurchasePaymentsReport'
import StockAdjustmentReport from './pages/pharmacy/reports/StockAdjustmentReport'
import NonMovingStockReport from './pages/pharmacy/reports/NonMovingStockReport'
import MinimumStockReport from './pages/pharmacy/reports/MinimumStockReport'
import SupplierWiseItemPurchase from './pages/pharmacy/reports/SupplierWiseItemPurchase'
import InvoiceStatusReport from './pages/pharmacy/reports/InvoiceStatusReport'
import ItemSaleTaxReport from './pages/pharmacy/reports/ItemSaleTaxReport'
import UserWiseDiscountReport from './pages/pharmacy/reports/UserWiseDiscountReport'
import GrnWiseSalesReport from './pages/pharmacy/reports/GrnWiseSalesReport'
import StockLedgerReport from './pages/pharmacy/reports/StockLedgerReport'

function withLayout(el) { return <Layout>{el}</Layout> }
function withPharmacyLayout(el) { return <PharmacyLayout>{el}</PharmacyLayout> }

const EXEC_ROLES = ['executive', 'admin', 'super_admin']
const PHARMACY_ROLES = ['pharmacy', 'admin', 'super_admin']
const LAB_ROLES = ['lab_technician', 'super_admin', 'admin']

const PLACEHOLDERS = [
  ['Inpatient Dashboard', '/executive/inpatient-dashboard'],
  ['Outpatient Dashboard', '/executive/outpatient-dashboard'],
  ['Advance Payment', '/executive/advance-payment'],
  ['New Discharge Summary', '/executive/new-discharge-summary'],
  ['Billing Summary', '/executive/billing-summary'],
  ['Referral Doctor', '/executive/referral-doctor'],
]

const PHARMACY_PLACEHOLDERS = [
  ['Tax Categories', '/pharmacy/masters/tax-categories'],
  ['Rack Master', '/pharmacy/masters/rack-master'],
  ['Item Master', '/pharmacy/masters/item-master'],
  ['Item Package Master', '/pharmacy/masters/item-package-master'],
  ['Drug Combination', '/pharmacy/masters/drug-combination'],
  ['Stock Returns', '/pharmacy/transaction/stock-returns'],
  ['Inpatient Sales Returns', '/pharmacy/sales-returns/inpatient'],
  ['Outpatient Sales Returns', '/pharmacy/sales-returns/outpatient'],
  ['Duplicate Invoice', '/pharmacy/duplicate-invoice'],
  ['Due Collections', '/pharmacy/due-collections'],
  ['Expenses', '/pharmacy/expenses'],
]

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Super Admin */}
        <Route path="/superadmin/dashboard" element={<ProtectedRoute roles={['super_admin']}>{withLayout(<SuperAdminDashboard />)}</ProtectedRoute>} />
        <Route path="/superadmin/users" element={<ProtectedRoute roles={['super_admin']}>{withLayout(<UserManagement />)}</ProtectedRoute>} />
        <Route path="/superadmin/discount-permissions" element={<ProtectedRoute roles={['super_admin']}>{withLayout(<DiscountPermissions />)}</ProtectedRoute>} />
        <Route path="/superadmin/permission-profiles" element={<ProtectedRoute roles={['super_admin']}>{withLayout(<PermissionProfiles />)}</ProtectedRoute>} />
        <Route path="/superadmin/doctors" element={<ProtectedRoute roles={['super_admin']}>{withLayout(<DoctorMaster />)}</ProtectedRoute>} />
        <Route path="/superadmin/lab-tests" element={<ProtectedRoute roles={['super_admin']}>{withLayout(<LabTests />)}</ProtectedRoute>} />
        <Route path="/superadmin/bulk-import" element={<ProtectedRoute roles={['super_admin']}>{withLayout(<BulkImport />)}</ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin/dashboard" element={<ProtectedRoute roles={['admin', 'super_admin']}>{withLayout(<AdminDashboard />)}</ProtectedRoute>} />
        <Route path="/admin/billing" element={<ProtectedRoute roles={['admin', 'super_admin']}>{withLayout(<AdminBillingManagement />)}</ProtectedRoute>} />

        {/* Executive */}
        <Route path="/executive/dashboard" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/dashboard">{withLayout(<ExecutiveDashboard />)}</ProtectedRoute>} />
        <Route path="/executive/billing-modifications" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/billing-modifications">{withLayout(<ExecutiveBillingModifications />)}</ProtectedRoute>} />
        <Route path="/executive/patient-registration" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/patient-registration">{withLayout(<PatientRegistration />)}</ProtectedRoute>} />
        <Route path="/executive/appointments" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/appointments">{withLayout(<Appointments />)}</ProtectedRoute>} />
        <Route path="/executive/admission" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/admission">{withLayout(<Admission />)}</ProtectedRoute>} />
        <Route path="/executive/op-billing" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/op-billing">{withLayout(<OPBilling />)}</ProtectedRoute>} />
        <Route path="/executive/ip-billing" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/ip-billing">{withLayout(<IPBilling />)}</ProtectedRoute>} />
        <Route path="/executive/out-patients" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/out-patients">{withLayout(<OutPatientList />)}</ProtectedRoute>} />
        <Route path="/executive/in-patients" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/in-patients">{withLayout(<InPatientList />)}</ProtectedRoute>} />
        <Route path="/executive/patient-records" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/patient-records">{withLayout(<PatientRecords />)}</ProtectedRoute>} />
        <Route path="/executive/direct-services" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/direct-services">{withLayout(<DirectServices />)}</ProtectedRoute>} />
        <Route path="/executive/room-occupation" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/room-occupation">{withLayout(<RoomOccupation />)}</ProtectedRoute>} />
        <Route path="/executive/room-transfer-approval" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/room-transfer-approval">{withLayout(<RoomTransferApproval />)}</ProtectedRoute>} />
        <Route path="/executive/patient-status" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/patient-status">{withLayout(<PatientStatus />)}</ProtectedRoute>} />
        <Route path="/executive/ip-advance" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/ip-advance">{withLayout(<AdvancePayment />)}</ProtectedRoute>} />
        <Route path="/executive/ip-advance/:id" element={<ProtectedRoute roles={EXEC_ROLES}>{withLayout(<AdvancePaymentDetail />)}</ProtectedRoute>} />
        <Route path="/executive/ip-details" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/ip-details">{withLayout(<IPDetails />)}</ProtectedRoute>} />
        <Route path="/executive/ip-lab" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/ip-lab">{withLayout(<IPLabPage />)}</ProtectedRoute>} />
        <Route path="/executive/ip-services" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/ip-services">{withLayout(<IPServicesPage />)}</ProtectedRoute>} />
        <Route path="/executive/ip-procedures" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/ip-procedures">{withLayout(<IPProceduresPage />)}</ProtectedRoute>} />
        <Route path="/executive/discharge-summary/:id?" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/discharge-summary">{withLayout(<DischargeSummary />)}</ProtectedRoute>} />
        <Route path="/executive/patient-overview/:id" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/patient-overview">{withLayout(<PatientOverview />)}</ProtectedRoute>} />
        <Route path="/executive/op-lab" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/op-lab">{withLayout(<OPLabPage />)}</ProtectedRoute>} />
        <Route path="/executive/op-services" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/op-services">{withLayout(<OPServicesPage />)}</ProtectedRoute>} />
        <Route path="/executive/op-procedures" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/op-procedures">{withLayout(<OPProceduresPage />)}</ProtectedRoute>} />
        <Route path="/executive/reports/ip-lab" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/reports/ip-lab">{withLayout(<IPLabReport />)}</ProtectedRoute>} />
        <Route path="/executive/reports/op-lab" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/reports/op-lab">{withLayout(<OPLabReport />)}</ProtectedRoute>} />
        <Route path="/executive/reports/ip-radiology" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/reports/ip-radiology">{withLayout(<IPRadiologyReport />)}</ProtectedRoute>} />
        <Route path="/executive/reports/op-radiology" element={<ProtectedRoute roles={EXEC_ROLES} path="/executive/reports/op-radiology">{withLayout(<OPRadiologyReport />)}</ProtectedRoute>} />

        {/* Pharmacy Main */}
        <Route path="/pharmacy/dashboard" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/dashboard">{withPharmacyLayout(<PharmacyDashboard />)}</ProtectedRoute>} />
        <Route path="/pharmacy/masters/inventory-type" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/masters/inventory-type">{withPharmacyLayout(<InventoryType />)}</ProtectedRoute>} />
        <Route path="/pharmacy/masters/item-type" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/masters/item-type">{withPharmacyLayout(<ItemType />)}</ProtectedRoute>} />
        <Route path="/pharmacy/masters/manufacturer" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/masters/manufacturer">{withPharmacyLayout(<ManufacturerMaster />)}</ProtectedRoute>} />
        <Route path="/pharmacy/masters/supplier" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/masters/supplier">{withPharmacyLayout(<SupplierMaster />)}</ProtectedRoute>} />
        <Route path="/pharmacy/transaction/purchase-order" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/transaction/purchase-order">{withPharmacyLayout(<PurchaseOrder />)}</ProtectedRoute>} />
        <Route path="/pharmacy/transaction/goods-receive-note" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/transaction/goods-receive-note">{withPharmacyLayout(<GoodsReceiveNote />)}</ProtectedRoute>} />
        <Route path="/pharmacy/transaction/stock-adjustments" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/transaction/stock-adjustments">{withPharmacyLayout(<StockAdjustments />)}</ProtectedRoute>} />
        <Route path="/pharmacy/sales/inpatient" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/sales/inpatient">{withPharmacyLayout(<InpatientSales />)}</ProtectedRoute>} />
        <Route path="/pharmacy/sales/outpatient" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/sales/outpatient">{withPharmacyLayout(<OutpatientSales />)}</ProtectedRoute>} />
        <Route path="/pharmacy/sales/patient-indents" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/sales/patient-indents">{withPharmacyLayout(<PatientIndents />)}</ProtectedRoute>} />
        <Route path="/pharmacy/sales/ot-indents" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/sales/ot-indents">{withPharmacyLayout(<OTIndents />)}</ProtectedRoute>} />
        <Route path="/pharmacy/stock" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/stock">{withPharmacyLayout(<ItemStock />)}</ProtectedRoute>} />

        {/* Pharmacy Reports — ALL explicitly connected! */}
        <Route path="/pharmacy/reports/total-sales" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/total-sales">{withPharmacyLayout(<TotalSalesReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/due-received" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/due-received">{withPharmacyLayout(<PharmacyDueReceivedReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/pharmacy-due" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/pharmacy-due">{withPharmacyLayout(<PharmacyDueReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/sales-returns" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/sales-returns">{withPharmacyLayout(<SalesReturns />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/op-ip-sales" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/op-ip-sales">{withPharmacyLayout(<OpIpSalesReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/op-ip-due" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/op-ip-due">{withPharmacyLayout(<OpIpDueReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/schedule-item" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/schedule-item">{withPharmacyLayout(<ScheduleItemReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/purchasewise-item" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/purchasewise-item">{withPharmacyLayout(<PurchasewiseItemReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/employee-sales" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/employee-sales">{withPharmacyLayout(<EmployeeSalesReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/sales" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/sales">{withPharmacyLayout(<SalesReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/new-sales" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/new-sales">{withPharmacyLayout(<NewSalesReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/product-wise-sales" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/product-wise-sales">{withPharmacyLayout(<ProductWiseSalesReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/grn" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/grn">{withPharmacyLayout(<GrnReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/grn-adjustment" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/grn-adjustment">{withPharmacyLayout(<GrnAdjustmentReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/profit" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/profit">{withPharmacyLayout(<ProfitReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/purchase-payments" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/purchase-payments">{withPharmacyLayout(<PurchaseReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/stock-returns" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/stock-returns">{withPharmacyLayout(<StockReturnsReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/supplier-wise-purchase" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/supplier-wise-purchase">{withPharmacyLayout(<SupplierWisePurchaseReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/grn-wise-purchase" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/grn-wise-purchase">{withPharmacyLayout(<GrnWisePurchaseReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/ot-indents" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/ot-indents">{withPharmacyLayout(<OtIndentsReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/doctor-sales" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/doctor-sales">{withPharmacyLayout(<DoctorSalesReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/doctor-wise-item-sales" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/doctor-wise-item-sales">{withPharmacyLayout(<DoctorWiseItemSalesReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/patient-wise-sale" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/patient-wise-sale">{withPharmacyLayout(<PatientWiseSaleReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/item-wise-sale" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/item-wise-sale">{withPharmacyLayout(<ItemWiseSaleReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/invoice-tax" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/invoice-tax">{withPharmacyLayout(<InvoiceTaxReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/purchase-payments-report" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/purchase-payments-report">{withPharmacyLayout(<PurchasePaymentsReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/stock-adjustment" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/stock-adjustment">{withPharmacyLayout(<StockAdjustmentReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/non-moving-stock" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/non-moving-stock">{withPharmacyLayout(<NonMovingStockReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/minimum-stock" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/minimum-stock">{withPharmacyLayout(<MinimumStockReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/supplier-wise-item-purchase" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/supplier-wise-item-purchase">{withPharmacyLayout(<SupplierWiseItemPurchase />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/invoice-status" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/invoice-status">{withPharmacyLayout(<InvoiceStatusReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/item-sale-tax" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/item-sale-tax">{withPharmacyLayout(<ItemSaleTaxReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/user-wise-discount" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/user-wise-discount">{withPharmacyLayout(<UserWiseDiscountReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/grn-wise-sales" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/grn-wise-sales">{withPharmacyLayout(<GrnWiseSalesReport />)}</ProtectedRoute>} />
        <Route path="/pharmacy/reports/stock-ledger" element={<ProtectedRoute roles={PHARMACY_ROLES} path="/pharmacy/reports/stock-ledger">{withPharmacyLayout(<StockLedgerReport />)}</ProtectedRoute>} />

        {/* Pharmacy Placeholders for un-built files */}
        {PHARMACY_PLACEHOLDERS.map(([label, path]) => (
          <Route key={path} path={path} element={
            <ProtectedRoute roles={PHARMACY_ROLES} path={path}>{withPharmacyLayout(<PharmacyComingSoon title={label} />)}</ProtectedRoute>
          } />
        ))}

        {/* Lab Technician */}
        <Route path="/lab" element={<LabLayout />}>
          <Route index element={<Navigate to="/lab/dashboard" replace />} />
          <Route path="dashboard" element={<ProtectedRoute roles={LAB_ROLES} path="/lab/dashboard"><LabDashboard /></ProtectedRoute>} />
          <Route path="op-reports" element={<ProtectedRoute roles={LAB_ROLES} path="/lab/op-reports"><OPReports /></ProtectedRoute>} />
          <Route path="ip-reports" element={<ProtectedRoute roles={LAB_ROLES} path="/lab/ip-reports"><IPReports /></ProtectedRoute>} />
          <Route path="test-master" element={<ProtectedRoute roles={LAB_ROLES} path="/lab/test-master"><TestMaster /></ProtectedRoute>} />
        </Route>

        {/* Executive placeholders */}
        {PLACEHOLDERS.map(([label, path]) => (
          <Route key={path} path={path} element={
            <ProtectedRoute roles={EXEC_ROLES}>{withLayout(<ComingSoon title={label} />)}</ProtectedRoute>
          } />
        ))}

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}