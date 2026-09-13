const express = require('express');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

const DB_FILE = path.join(__dirname, 'database.json');
const CORRECT_PASSWORD = "albaraa123454321";

// --- تهيئة قاعدة البيانات المحلية الآمنة ---
const initialData = {
    customers: [],
    suppliers: [],
    drivers: [],
    vehicles: [],
    employees: [],
    invoices: [], // فواتير البيع
    purchases: [], // فواتير الشراء
    expenses: [],
    customerPayments: [],
    supplierPayments: []
};

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
}

function loadDB() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return initialData;
    }
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const getTodayDate = () => new Date().toISOString().split('T')[0];

// --- 0. ممر الحماية (Middleware) لطلب كلمة السر ---
app.use((req, res, next) => {
    // السماح بالمرور لصفحة تسجيل الدخول وإرسال الباسوورد
    if (req.path === '/login') {
        return next();
    }

    // التحقق من الكوكيز أو الهيدر إن كان المستخدم مسجلاً دخولاً
    const isAuthed = req.cookies && req.cookies.albaraa_auth === 'true';
    if (!isAuthed) {
        return res.send(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>تسجيل الدخول - شركة البراء</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
                    body { background: #0f172a; height: 100vh; display: flex; justify-content: center; align-items: center; }
                    .login-card { background: #ffffff; padding: 40px 30px; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3); width: 90%; max-width: 400px; text-align: center; }
                    .login-card h2 { margin-bottom: 8px; color: #1e293b; }
                    .login-card p { color: #64748b; font-size: 14px; margin-bottom: 24px; }
                    .login-card input { width: 100%; padding: 12px 16px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 16px; margin-bottom: 16px; outline: none; text-align: center; }
                    .login-card input:focus { border-color: #2563eb; }
                    .login-card button { width: 100%; padding: 12px; background-color: #2563eb; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: bold; }
                    .login-card button:hover { background-color: #1d4ed8; }
                    .error-msg { color: #ef4444; font-size: 14px; margin-top: 12px; }
                </style>
            </head>
            <body>
                <div class="login-card">
                    <h2>🏢 شركة البراء</h2>
                    <p>يرجى إدخال كلمة السر للدخول إلى النظام</p>
                    <form action="/login" method="POST">
                        <input type="password" name="password" placeholder="أدخل كلمة السر" required autofocus>
                        <button type="submit">دخول</button>
                    </form>
                    ${req.query.error ? '<p class="error-msg">كلمة السر غير صحيحة!</p>' : ''}
                </div>
            </body>
            </html>
        `);
    }
    next();
});

// معالجة طلب تسجيل الدخول
app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === CORRECT_PASSWORD) {
        res.cookie('albaraa_auth', 'true', { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }); // تبقى صالحة ليوم كامل
        return res.redirect('/');
    }
    res.redirect('/login?error=1');
});

// --- التصميم والواجهة العامة الموحدة ---
const renderLayout = (title, content, activeTab = 'home') => {
    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - شركة البراء</title>
    <style>
        :root { --primary: #0f2137; --secondary: #1e3a8a; --bg: #f8fafc; --card: #ffffff; --text: #0f172a; --accent: #2563eb; --danger: #dc2626; --success: #16a34a; }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
        body { background: var(--bg); color: var(--text); padding-bottom: 90px; }
        .header { background: var(--primary); color: white; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header h1 { font-size: 18px; }
        .container { max-width: 1200px; margin: 20px auto; padding: 0 15px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .card { background: var(--card); padding: 18px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .card h3 { font-size: 13px; color: #64748b; margin-bottom: 8px; }
        .card .val { font-size: 20px; font-weight: bold; color: var(--primary); }
        .btn { background: var(--primary); color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; text-decoration: none; display: inline-block; text-align: center; font-size: 13px; }
        .btn-success { background: var(--success); }
        .btn-danger { background: var(--danger); }
        .btn-secondary { background: #e2e8f0; color: var(--text); }
        .btn-whatsapp { background: #25D366; color: white; }
        .form-group { margin-bottom: 12px; }
        .form-group label { display: block; font-size: 12px; font-weight: bold; margin-bottom: 5px; color: #475569; }
        input, select, textarea { width: 100%; padding: 10px; border: 1px solid #cbd5e0; border-radius: 8px; font-size: 14px; outline: none; background: #fff; }
        table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; margin-top: 15px; border: 1px solid #e2e8f0; }
        th, td { padding: 12px; text-align: right; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
        th { background: #f1f5f9; color: #475569; font-weight: bold; }
        .nav-bar { position: fixed; bottom: 0; left: 0; right: 0; background: var(--primary); display: flex; justify-content: space-around; padding: 10px 0; border-top-left-radius: 16px; border-top-right-radius: 16px; box-shadow: 0 -2px 10px rgba(0,0,0,0.1); z-index: 1000; overflow-x: auto; }
        .nav-item { color: #94a3b8; text-decoration: none; font-size: 11px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 3px; white-space: nowrap; padding: 0 5px; }
        .nav-item.active { color: white; font-weight: bold; }
        .flex-gap { display: flex; gap: 10px; flex-wrap: wrap; }
        .badge { padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; }
        .badge-sale { background: #dcfce7; color: #166534; }
        .badge-purchase { background: #fee2e2; color: #991b1b; }
        @media print {
            .header, .nav-bar, .no-print { display: none !important; }
            body { padding: 0; background: white; }
            .container { max-width: 100%; margin: 0; padding: 0; }
            .card { border: none; box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏢 شركة البراء لإدارة التجهيز والنقل</h1>
        <div style="display: flex; align-items: center; gap: 15px;">
            <span style="font-size:12px; opacity:0.8;">📅 ${getTodayDate()}</span>
            <a href="/logout" style="color: #fca5a5; font-size: 12px; text-decoration: none; background: rgba(239, 68, 68, 0.2); padding: 4px 8px; border-radius: 6px;">خروج 🔒</a>
        </div>
    </div>

    <div class="container">
        ${content}
    </div>

    <div class="nav-bar">
        <a href="/" class="nav-item ${activeTab==='home'?'active':''}"><span>🏠</span>الرئيسية</a>
        <a href="/invoices" class="nav-item ${activeTab==='invoices'?'active':''}"><span>📄</span>قسم الفواتير</a>
        <a href="/customers" class="nav-item ${activeTab==='customers'?'active':''}"><span>👥</span>الزبائن والعملاء</a>
        <a href="/suppliers" class="nav-item ${activeTab==='suppliers'?'active':''}"><span>🏭</span>المجهزين</a>
        <a href="/fleet" class="nav-item ${activeTab==='fleet'?'active':''}"><span>🚚</span>النقل</a>
        <a href="/employees" class="nav-item ${activeTab==='employees'?'active':''}"><span>👔</span>الموظفين</a>
        <a href="/expenses" class="nav-item ${activeTab==='expenses'?'active':''}"><span>💸</span>المصاريف</a>
        <a href="/reports" class="nav-item ${activeTab==='reports'?'active':''}"><span>📊</span>التقارير</a>
    </div>
</body>
</html>
`;
};

// مسار تسجيل الخروج
app.get('/logout', (req, res) => {
    res.clearCookie('albaraa_auth');
    res.redirect('/');
});

// --- دالة مساعدة لتوليد نص فاتورة البيع ---
function generateSaleInvoiceText(inv) {
    const unit = inv.unit || 'طن';
    const remaining = Number(inv.total) - Number(inv.paid);
    return `*🏢 شركة البراء لإدارة التجهيز والنقل*
----------------------------------
*فاتورة بيع رقم:* ${inv.id}
*التاريخ:* ${inv.date}
*الزبون:* ${inv.customerName}
*نوع المادة:* ${inv.cementType}
*الكمية:* ${inv.qty} ${unit}
*سعر الـ (${unit}):* ${Number(inv.price).toLocaleString()} د.ع
*المبلغ الإجمالي:* ${Number(inv.total).toLocaleString()} د.ع
*المبلغ الواصل:* ${Number(inv.paid).toLocaleString()} د.ع
*المبلغ المتبقي:* ${remaining.toLocaleString()} د.ع
----------------------------------
*السائق:* ${inv.driverName || '—'}
*المركبة:* ${inv.vehicleNumber || '—'}
*المندوب:* ${inv.delegateName || '—'}
*الكادر:* ${inv.cadre || '—'}
*ملاحظات:* ${inv.notes || 'لا يوجد'}`;
}

// --- دالة مساعدة لتوليد نص فاتورة الشراء ---
function generatePurchaseInvoiceText(pur) {
    const unit = pur.unit || 'طن';
    const remaining = Number(pur.total) - Number(pur.paid);
    return `*🏢 شركة البراء لإدارة التجهيز والنقل*
----------------------------------
*فاتورة شراء رقم:* ${pur.id}
*التاريخ:* ${pur.date}
*المجهز / المعمل:* ${pur.supplierName}
*نوع المادة:* ${pur.cementType}
*الكمية:* ${pur.qty} ${unit}
*سعر الـ (${unit}):* ${Number(pur.price || 0).toLocaleString()} د.ع
*المبلغ الإجمالي:* ${Number(pur.total).toLocaleString()} د.ع
*المبلغ الواصل (المدفوع):* ${Number(pur.paid).toLocaleString()} د.ع
*المبلغ المتبقي للمجهز:* ${remaining.toLocaleString()} د.ع
----------------------------------
*ملاحظات:* ${pur.notes || 'لا يوجد'}`;
}

// --- 1. القائمة الرئيسية (Dashboard) ---
app.get('/', (req, res) => {
    const db = loadDB();
    const today = getTodayDate();

    const todayInvoices = db.invoices.filter(i => i.date === today);
    const todaySales = todayInvoices.reduce((a, b) => a + (Number(b.total) || 0), 0);
    const todayCustomerPayments = db.customerPayments.filter(p => p.date === today).reduce((a, b) => a + (Number(b.amount) || 0), 0);
    
    const todayPurchases = db.purchases.filter(p => p.date === today).reduce((a, b) => a + (Number(b.total) || 0), 0);
    const todaySupplierPayments = db.supplierPayments.filter(p => p.date === today).reduce((a, b) => a + (Number(b.amount) || 0), 0);
    
    const todayExpenses = db.expenses.filter(e => e.date === today).reduce((a, b) => a + (Number(b.amount) || 0), 0);

    const totalCustomerDebts = db.customers.reduce((acc, c) => {
        const invs = db.invoices.filter(i => i.customerId == c.id);
        const pays = db.customerPayments.filter(p => p.customerId == c.id);
        const tot = invs.reduce((a, b) => a + Number(b.total), 0);
        const pd = invs.reduce((a, b) => a + Number(b.paid), 0) + pays.reduce((a, b) => a + Number(b.amount), 0);
        return acc + (tot - pd);
    }, 0);

    const totalSupplierDebts = db.suppliers.reduce((acc, s) => {
        const pur = db.purchases.filter(p => p.supplierId == s.id);
        const pays = db.supplierPayments.filter(p => p.supplierId == s.id);
        const tot = pur.reduce((a, b) => a + Number(b.total), 0);
        const pd = pur.reduce((a, b) => a + Number(b.paid), 0) + pays.reduce((a, b) => a + Number(b.amount), 0);
        return acc + (tot - pd);
    }, 0);

    const netCashMovement = todayCustomerPayments - (todaySupplierPayments + todayExpenses);

    const content = `
        <h2 style="margin-bottom:15px;">لوحة المؤشرات السريعة والحركة اليومية</h2>
        <div class="grid">
            <div class="card"><h3>إجمالي مبيعات اليوم</h3><div class="val">${todaySales.toLocaleString()} د.ع</div></div>
            <div class="card"><h3>واصل اليوم من الزبائن</h3><div class="val" style="color:var(--success);">${todayCustomerPayments.toLocaleString()} د.ع</div></div>
            <div class="card"><h3>مشتريات اليوم</h3><div class="val">${todayPurchases.toLocaleString()} د.ع</div></div>
            <div class="card"><h3>مدفوع للمجهزين اليوم</h3><div class="val" style="color:var(--danger);">${todaySupplierPayments.toLocaleString()} د.ع</div></div>
            <div class="card"><h3>مصروفات اليوم التشغيلية</h3><div class="val" style="color:var(--danger);">${todayExpenses.toLocaleString()} د.ع</div></div>
            <div class="card"><h3>إجمالي ديون الزبائن</h3><div class="val" style="color:var(--danger);">${totalCustomerDebts.toLocaleString()} د.ع</div></div>
            <div class="card"><h3>إجمالي ديون المجهزين</h3><div class="val">${totalSupplierDebts.toLocaleString()} د.ع</div></div>
            <div class="card"><h3>صافي حركة النقد اليومي</h3><div class="val" style="color:${netCashMovement >= 0 ? 'var(--success)' : 'var(--danger)'}">${netCashMovement.toLocaleString()} د.ع</div></div>
        </div>

        <div class="flex-gap" style="margin-top:20px;">
            <a href="/invoices/new-sale" class="btn btn-success">+ إنشاء فاتورة بيع جديدة</a>
            <a href="/invoices/new-purchase" class="btn btn-secondary">+ إنشاء فاتورة شراء جديدة</a>
            <a href="/customers" class="btn">+ تسجيل زبون جديد</a>
            <a href="/suppliers" class="btn">+ تسجيل مجهز جديد</a>
            <a href="/expenses" class="btn btn-secondary">+ تسجيل مصروف جديد</a>
        </div>
    `;

    res.send(renderLayout('الرئيسية', content, 'home'));
});

// --- 2. قسم الفواتير (فواتير البيع وفواتير الشراء وأرشيف الفلترة مع التعديل والحذف) ---
app.get('/invoices', (req, res) => {
    const db = loadDB();
    const { type = 'sale', name, startMonth, endMonth } = req.query;

    let saleList = [...db.invoices];
    let purchaseList = [...db.purchases];

    if (name) {
        saleList = saleList.filter(i => (i.customerName || '').toLowerCase().includes(name.toLowerCase()));
        purchaseList = purchaseList.filter(p => (p.supplierName || '').toLowerCase().includes(name.toLowerCase()));
    }

    if (startMonth) {
        saleList = saleList.filter(i => i.date && i.date.slice(0, 7) >= startMonth);
        purchaseList = purchaseList.filter(p => p.date && p.date.slice(0, 7) >= startMonth);
    }
    if (endMonth) {
        saleList = saleList.filter(i => i.date && i.date.slice(0, 7) <= endMonth);
        purchaseList = purchaseList.filter(p => p.date && p.date.slice(0, 7) <= endMonth);
    }

    const saleRows = saleList.map(i => {
        const customer = db.customers.find(c => c.id == i.customerId);
        const phone = customer ? customer.phone : '';
        const text = generateSaleInvoiceText(i);
        const waUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;

        return `
        <tr>
            <td><span class="badge badge-sale">بيع</span> ${i.id}</td>
            <td>${i.date}</td>
            <td><b>${i.customerName}</b></td>
            <td>${i.cementType}</td>
            <td>${i.qty} ${i.unit || 'طن'}</td>
            <td>${Number(i.price).toLocaleString()} د.ع</td>
            <td><b>${Number(i.total).toLocaleString()} د.ع</b></td>
            <td>${Number(i.paid).toLocaleString()} د.ع</td>
            <td>${(Number(i.total) - Number(i.paid)).toLocaleString()} د.ع</td>
            <td>
                <a href="/invoices/view-sale/${i.id}" class="btn" style="padding:4px 8px; font-size:11px;">عرض/طباعة</a>
                <a href="/invoices/edit-sale/${i.id}" class="btn btn-secondary" style="padding:4px 8px; font-size:11px;">تعديل</a>
                <a href="/invoices/delete-sale/${i.id}" onclick="return confirm('هل أنت تأكد من حذف فاتورة البيع هذه؟')" class="btn btn-danger" style="padding:4px 8px; font-size:11px;">حذف</a>
                <a href="${waUrl}" target="_blank" class="btn btn-whatsapp" style="padding:4px 8px; font-size:11px;">📲 واتساب</a>
            </td>
        </tr>
        `;
    }).join('');

    const purchaseRows = purchaseList.map(p => {
        const supplier = db.suppliers.find(s => s.id == p.supplierId);
        const phone = supplier ? supplier.phone : '';
        const supplierName = supplier ? supplier.name : (p.supplierName || 'مجهز');
        p.supplierName = supplierName;
        const text = generatePurchaseInvoiceText(p);
        const waUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;

        return `
        <tr>
            <td><span class="badge badge-purchase">شراء</span> ${p.id}</td>
            <td>${p.date}</td>
            <td><b>${supplierName}</b></td>
            <td>${p.cementType}</td>
            <td>${p.qty} ${p.unit || 'طن'}</td>
            <td>${Number(p.price || 0).toLocaleString()} د.ع</td>
            <td><b>${Number(p.total).toLocaleString()} د.ع</b></td>
            <td>${Number(p.paid).toLocaleString()} د.ع</td>
            <td>${(Number(p.total) - Number(p.paid)).toLocaleString()} د.ع</td>
            <td>
                <a href="/invoices/view-purchase/${p.id}" class="btn" style="padding:4px 8px; font-size:11px;">عرض/طباعة</a>
                <a href="/invoices/edit-purchase/${p.id}" class="btn btn-secondary" style="padding:4px 8px; font-size:11px;">تعديل</a>
                <a href="/invoices/delete-purchase/${p.id}" onclick="return confirm('هل أنت تأكد من حذف فاتورة الشراء هذه؟')" class="btn btn-danger" style="padding:4px 8px; font-size:11px;">حذف</a>
                <a href="${waUrl}" target="_blank" class="btn btn-whatsapp" style="padding:4px 8px; font-size:11px;">📲 واتساب</a>
            </td>
        </tr>
        `;
    }).join('');

    const content = `
        <div class="flex-gap" style="justify-content:space-between; align-items:center;">
            <h2>أرشيف وإدارة الفواتير (شركة البراء)</h2>
            <div class="flex-gap">
                <a href="/invoices/new-sale" class="btn btn-success">+ فاتورة بيع جديد</a>
                <a href="/invoices/new-purchase" class="btn btn-secondary">+ فاتورة شراء جديد</a>
            </div>
        </div>
        <br>
        
        <div class="card">
            <form method="GET" action="/invoices" class="flex-gap" style="align-items:flex-end;">
                <input type="hidden" name="type" value="${type}">
                <div style="flex:1;">
                    <label style="font-size:11px; font-weight:bold;">البحث بالاسم:</label>
                    <input type="text" name="name" placeholder="اسم الزبون أو المجهز..." value="${name||''}">
                </div>
                <div style="flex:1;">
                    <label style="font-size:11px; font-weight:bold;">من شهر:</label>
                    <input type="month" name="startMonth" value="${startMonth||''}">
                </div>
                <div style="flex:1;">
                    <label style="font-size:11px; font-weight:bold;">إلى شهر:</label>
                    <input type="month" name="endMonth" value="${endMonth||''}">
                </div>
                <button class="btn">تطبيق الفلترة</button>
                <a href="/invoices" class="btn btn-secondary">إلغاء</a>
            </form>
        </div>

        <div style="margin-top:20px;" class="no-print">
            <a href="/invoices?type=sale&name=${name||''}&startMonth=${startMonth||''}&endMonth=${endMonth||''}" class="btn ${type==='sale'?'':'btn-secondary'}">🛒 فواتير المبيعات (${saleList.length})</a>
            <a href="/invoices?type=purchase&name=${name||''}&startMonth=${startMonth||''}&endMonth=${endMonth||''}" class="btn ${type==='purchase'?'':'btn-secondary'}">🏭 فواتير المشتريات (${purchaseList.length})</a>
        </div>

        ${type === 'sale' ? `
            <table>
                <thead>
                    <tr>
                        <th>رقم الوصل</th>
                        <th>التاريخ</th>
                        <th>الزبون</th>
                        <th>المادة</th>
                        <th>الكمية والوحدة</th>
                        <th>سعر الوحدة</th>
                        <th>الإجمالي</th>
                        <th>الواصل</th>
                        <th>المتبقي</th>
                        <th>الإجراء</th>
                    </tr>
                </thead>
                <tbody>${saleRows || '<tr><td colspan="10" style="text-align:center;">لا توجد فواتير بيع مطابقة للبحث</td></tr>'}</tbody>
            </table>
        ` : `
            <table>
                <thead>
                    <tr>
                        <th>رقم الوصل</th>
                        <th>التاريخ</th>
                        <th>المجهز</th>
                        <th>المادة</th>
                        <th>الكمية والوحدة</th>
                        <th>سعر الوحدة</th>
                        <th>الإجمالي</th>
                        <th>الواصل (المدفوع)</th>
                        <th>المتبقي</th>
                        <th>الإجراء</th>
                    </tr>
                </thead>
                <tbody>${purchaseRows || '<tr><td colspan="10" style="text-align:center;">لا توجد فواتير شراء مطابقة للبحث</td></tr>'}</tbody>
            </table>
        `}
    `;

    res.send(renderLayout('قسم الفواتير', content, 'invoices'));
});

// --- إنشاء فاتورة بيع جديدة ---
app.get('/invoices/new-sale', (req, res) => {
    const db = loadDB();
    const customerOpts = db.customers.map(c => `<option value="${c.id}">${c.name} ${c.phone ? '(' + c.phone + ')' : ''}</option>`).join('');
    const driverOpts = db.drivers.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
    const vehicleOpts = db.vehicles.map(v => `<option value="${v.number}">${v.number}</option>`).join('');

    const content = `
        <h2>🛒 إنشاء فاتورة بيع جديدة</h2>
        <br>
        <form action="/invoices/save-sale" method="POST" class="card">
            <div class="form-group">
                <label>اختر الزبون</label>
                <select name="customerId" required>
                    <option value="">اختر الزبون المسجل...</option>
                    ${customerOpts}
                </select>
            </div>
            <div class="flex-gap">
                <div class="form-group" style="flex:2;">
                    <label>نوع المادة (سمنت / كونكريت / تفنيش...)</label>
                    <input type="text" name="cementType" placeholder="مثال: كونكريت جاهز، سمنت مقاوم" required>
                </div>
                <div class="form-group" style="flex:1;">
                    <label>وحدة القياس</label>
                    <select name="unit" id="unitSelect">
                        <option value="متر مكعب (م³)">متر مكعب (م³)</option>
                        <option value="طن" selected>طن</option>
                        <option value="لتر">لتر</option>
                    </select>
                </div>
            </div>
            <div class="flex-gap">
                <div class="form-group" style="flex:1;">
                    <label>الكمية</label>
                    <input type="number" step="0.01" name="qty" id="qtyInput" required placeholder="0.00" oninput="calcTotal()">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>سعر الوحدة الواحدة (د.ع)</label>
                    <input type="number" name="price" id="priceInput" required placeholder="0" oninput="calcTotal()">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>المبلغ الإجمالي (حساب تلقائي)</label>
                    <input type="number" name="total" id="totalInput" readonly style="background:#f1f5f9; font-weight:bold; color:var(--primary);">
                </div>
            </div>
            <div class="flex-gap">
                <div class="form-group" style="flex:1;">
                    <label>المبلغ الواصل (النقد المقبوض)</label>
                    <input type="number" name="paid" id="paidInput" value="0" placeholder="0" oninput="calcTotal()">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>المبلغ المتبقي (حساب تلقائي)</label>
                    <input type="number" id="remainingInput" readonly style="background:#f1f5f9; font-weight:bold; color:var(--danger);">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>التاريخ</label>
                    <input type="date" name="date" value="${getTodayDate()}" required>
                </div>
            </div>
            <div class="flex-gap">
                <div class="form-group" style="flex:1;">
                    <label>اسم المندوب</label>
                    <input type="text" name="delegateName" placeholder="اسم المندوب">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>السائق</label>
                    <select name="driverName">
                        <option value="">اختر السائق...</option>
                        ${driverOpts}
                    </select>
                </div>
                <div class="form-group" style="flex:1;">
                    <label>المركبة</label>
                    <select name="vehicleNumber">
                        <option value="">اختر رقم المركبة...</option>
                        ${vehicleOpts}
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>الكادر المسلم</label>
                <input type="text" name="cadre" placeholder="اسم الكادر المسؤول">
            </div>
            <div class="form-group">
                <label>ملاحظات الفاتورة</label>
                <textarea name="notes" rows="2" placeholder="أي تفاصيل تخص الحمولات والتسليم"></textarea>
            </div>
            <button class="btn btn-success" style="width:100%;">حفظ وإصدار الفاتورة فوراً</button>
        </form>

        <script>
            function calcTotal() {
                const q = parseFloat(document.getElementById('qtyInput').value) || 0;
                const p = parseFloat(document.getElementById('priceInput').value) || 0;
                const paid = parseFloat(document.getElementById('paidInput').value) || 0;
                const total = Math.round(q * p);
                document.getElementById('totalInput').value = total;
                document.getElementById('remainingInput').value = Math.round(total - paid);
            }
            window.onload = calcTotal;
        </script>
    `;

    res.send(renderLayout('فاتورة بيع جديدة', content, 'invoices'));
});

app.post('/invoices/save-sale', (req, res) => {
    const db = loadDB();
    const customer = db.customers.find(c => c.id == req.body.customerId);
    const qty = Number(req.body.qty) || 0;
    const price = Number(req.body.price) || 0;
    const total = qty * price;

    const newInv = {
        id: 'SALE-' + Date.now().toString().slice(-6),
        customerId: req.body.customerId,
        customerName: customer ? customer.name : 'زبون غير مسجل',
        cementType: req.body.cementType,
        unit: req.body.unit || 'طن',
        delegateName: req.body.delegateName,
        driverName: req.body.driverName,
        vehicleNumber: req.body.vehicleNumber,
        cadre: req.body.cadre,
        date: req.body.date,
        qty: qty,
        price: price,
        total: total,
        paid: Number(req.body.paid) || 0,
        notes: req.body.notes
    };

    db.invoices.push(newInv);
    saveDB(db);

    res.redirect(`/invoices/view-sale/${newInv.id}`);
});

// --- تعديل فاتورة بيع ---
app.get('/invoices/edit-sale/:id', (req, res) => {
    const db = loadDB();
    const inv = db.invoices.find(i => i.id === req.params.id);
    if (!inv) return res.send('الفاتورة غير موجودة');

    const customerOpts = db.customers.map(c => `<option value="${c.id}" ${c.id == inv.customerId ? 'selected' : ''}>${c.name} ${c.phone ? '(' + c.phone + ')' : ''}</option>`).join('');
    const driverOpts = db.drivers.map(d => `<option value="${d.name}" ${d.name === inv.driverName ? 'selected' : ''}>${d.name}</option>`).join('');
    const vehicleOpts = db.vehicles.map(v => `<option value="${v.number}" ${v.number === inv.vehicleNumber ? 'selected' : ''}>${v.number}</option>`).join('');

    const content = `
        <h2>✏️ تعديل فاتورة بيع (${inv.id})</h2>
        <br>
        <form action="/invoices/update-sale/${inv.id}" method="POST" class="card">
            <div class="form-group">
                <label>اختر الزبون</label>
                <select name="customerId" required>
                    <option value="">اختر الزبون المسجل...</option>
                    ${customerOpts}
                </select>
            </div>
            <div class="flex-gap">
                <div class="form-group" style="flex:2;">
                    <label>نوع المادة</label>
                    <input type="text" name="cementType" value="${inv.cementType || ''}" required>
                </div>
                <div class="form-group" style="flex:1;">
                    <label>وحدة القياس</label>
                    <select name="unit">
                        <option value="متر مكعب (م³)" ${inv.unit === 'متر مكعب (م³)' ? 'selected' : ''}>متر مكعب (م³)</option>
                        <option value="طن" ${inv.unit === 'طن' ? 'selected' : ''}>طن</option>
                        <option value="لتر" ${inv.unit === 'لتر' ? 'selected' : ''}>لتر</option>
                    </select>
                </div>
            </div>
            <div class="flex-gap">
                <div class="form-group" style="flex:1;">
                    <label>الكمية</label>
                    <input type="number" step="0.01" name="qty" id="qtyInput" value="${inv.qty}" required oninput="calcTotal()">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>سعر الوحدة الواحدة (د.ع)</label>
                    <input type="number" name="price" id="priceInput" value="${inv.price}" required oninput="calcTotal()">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>المبلغ الإجمالي</label>
                    <input type="number" name="total" id="totalInput" value="${inv.total}" readonly style="background:#f1f5f9; font-weight:bold; color:var(--primary);">
                </div>
            </div>
            <div class="flex-gap">
                <div class="form-group" style="flex:1;">
                    <label>المبلغ الواصل</label>
                    <input type="number" name="paid" id="paidInput" value="${inv.paid}" oninput="calcTotal()">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>المبلغ المتبقي</label>
                    <input type="number" id="remainingInput" readonly style="background:#f1f5f9; font-weight:bold; color:var(--danger);">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>التاريخ</label>
                    <input type="date" name="date" value="${inv.date}" required>
                </div>
            </div>
            <div class="flex-gap">
                <div class="form-group" style="flex:1;">
                    <label>اسم المندوب</label>
                    <input type="text" name="delegateName" value="${inv.delegateName || ''}">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>السائق</label>
                    <select name="driverName">
                        <option value="">اختر السائق...</option>
                        ${driverOpts}
                    </select>
                </div>
                <div class="form-group" style="flex:1;">
                    <label>المركبة</label>
                    <select name="vehicleNumber">
                        <option value="">اختر رقم المركبة...</option>
                        ${vehicleOpts}
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>الكادر المسلم</label>
                <input type="text" name="cadre" value="${inv.cadre || ''}">
            </div>
            <div class="form-group">
                <label>ملاحظات الفاتورة</label>
                <textarea name="notes" rows="2">${inv.notes || ''}</textarea>
            </div>
            <div class="flex-gap">
                <button class="btn btn-success" style="flex:1;">تحديث وحفظ التعديلات</button>
                <a href="/invoices" class="btn btn-secondary">إلغاء</a>
            </div>
        </form>

        <script>
            function calcTotal() {
                const q = parseFloat(document.getElementById('qtyInput').value) || 0;
                const p = parseFloat(document.getElementById('priceInput').value) || 0;
                const paid = parseFloat(document.getElementById('paidInput').value) || 0;
                const total = Math.round(q * p);
                document.getElementById('totalInput').value = total;
                document.getElementById('remainingInput').value = Math.round(total - paid);
            }
            window.onload = calcTotal;
        </script>
    `;

    res.send(renderLayout('تعديل فاتورة بيع', content, 'invoices'));
});

app.post('/invoices/update-sale/:id', (req, res) => {
    const db = loadDB();
    const idx = db.invoices.findIndex(i => i.id === req.params.id);
    if (idx !== -1) {
        const customer = db.customers.find(c => c.id == req.body.customerId);
        const qty = Number(req.body.qty) || 0;
        const price = Number(req.body.price) || 0;
        const total = qty * price;

        db.invoices[idx] = {
            ...db.invoices[idx],
            customerId: req.body.customerId,
            customerName: customer ? customer.name : 'زبون غير مسجل',
            cementType: req.body.cementType,
            unit: req.body.unit || 'طن',
            delegateName: req.body.delegateName,
            driverName: req.body.driverName,
            vehicleNumber: req.body.vehicleNumber,
            cadre: req.body.cadre,
            date: req.body.date,
            qty: qty,
            price: price,
            total: total,
            paid: Number(req.body.paid) || 0,
            notes: req.body.notes
        };
        saveDB(db);
    }
    res.redirect('/invoices?type=sale');
});

// --- حذف فاتورة بيع ---
app.get('/invoices/delete-sale/:id', (req, res) => {
    const db = loadDB();
    db.invoices = db.invoices.filter(i => i.id !== req.params.id);
    saveDB(db);
    res.redirect('/invoices?type=sale');
});

// --- إنشاء فاتورة شراء جديدة ---
app.get('/invoices/new-purchase', (req, res) => {
    const db = loadDB();
    const supplierOpts = db.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    const content = `
        <h2>🏭 إنشاء فاتورة شراء جديدة من مجهز</h2>
        <br>
        <form action="/invoices/save-purchase" method="POST" class="card">
            <div class="form-group">
                <label>اختر المجهز / المعمل</label>
                <select name="supplierId" required>
                    <option value="">اختر المجهز...</option>
                    ${supplierOpts}
                </select>
            </div>
            <div class="flex-gap">
                <div class="form-group" style="flex:2;">
                    <label>نوع المادة / الشحنة</label>
                    <input type="text" name="cementType" placeholder="مثال: سمنت فل، حصى، مواد أولية" required>
                </div>
                <div class="form-group" style="flex:1;">
                    <label>وحدة القياس</label>
                    <select name="unit">
                        <option value="متر مكعب (م³)">متر مكعب (م³)</option>
                        <option value="طن" selected>طن</option>
                        <option value="لتر">لتر</option>
                    </select>
                </div>
            </div>
            <div class="flex-gap">
                <div class="form-group" style="flex:1;">
                    <label>الكمية</label>
                    <input type="number" step="0.01" name="qty" id="qtyPur" required placeholder="0.00" oninput="calcPurTotal()">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>سعر الوحدة (د.ع)</label>
                    <input type="number" name="price" id="pricePur" required placeholder="0" oninput="calcPurTotal()">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>المبلغ الإجمالي (حساب تلقائي)</label>
                    <input type="number" name="total" id="totalPur" readonly style="background:#f1f5f9; font-weight:bold; color:var(--primary);">
                </div>
            </div>
            <div class="flex-gap">
                <div class="form-group" style="flex:1;">
                    <label>المبلغ الواصل (المدفوع للمجهز)</label>
                    <input type="number" name="paid" id="paidPur" value="0" placeholder="0" oninput="calcPurTotal()">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>المبلغ المتبقي (حساب تلقائي)</label>
                    <input type="number" id="remainingPur" readonly style="background:#f1f5f9; font-weight:bold; color:var(--danger);">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>التاريخ</label>
                    <input type="date" name="date" value="${getTodayDate()}" required>
                </div>
            </div>
            <div class="form-group">
                <label>ملاحظات تفصيلية</label>
                <textarea name="notes" rows="2" placeholder="ملاحظات حول الشحنة أو رقم السند"></textarea>
            </div>
            <button class="btn btn-success" style="width:100%;">حفظ فاتورة الشراء</button>
        </form>

        <script>
            function calcPurTotal() {
                const q = parseFloat(document.getElementById('qtyPur').value) || 0;
                const p = parseFloat(document.getElementById('pricePur').value) || 0;
                const paid = parseFloat(document.getElementById('paidPur').value) || 0;
                const total = Math.round(q * p);
                document.getElementById('totalPur').value = total;
                document.getElementById('remainingPur').value = Math.round(total - paid);
            }
            window.onload = calcPurTotal;
        </script>
    `;

    res.send(renderLayout('فاتورة شراء جديدة', content, 'invoices'));
});

app.post('/invoices/save-purchase', (req, res) => {
    const db = loadDB();
    const supplier = db.suppliers.find(s => s.id == req.body.supplierId);
    const qty = Number(req.body.qty) || 0;
    const price = Number(req.body.price) || 0;
    const total = qty * price;

    const newPur = {
        id: 'PUR-' + Date.now().toString().slice(-6),
        supplierId: req.body.supplierId,
        supplierName: supplier ? supplier.name : 'مجهز غير مسجل',
        cementType: req.body.cementType,
        unit: req.body.unit || 'طن',
        qty: qty,
        price: price,
        total: total,
        paid: Number(req.body.paid) || 0,
        date: req.body.date,
        notes: req.body.notes
    };

    db.purchases.push(newPur);
    saveDB(db);

    res.redirect(`/invoices/view-purchase/${newPur.id}`);
});

// --- تعديل فاتورة شراء ---
app.get('/invoices/edit-purchase/:id', (req, res) => {
    const db = loadDB();
    const pur = db.purchases.find(p => p.id === req.params.id);
    if (!pur) return res.send('فاتورة الشراء غير موجودة');

    const supplierOpts = db.suppliers.map(s => `<option value="${s.id}" ${s.id == pur.supplierId ? 'selected' : ''}>${s.name}</option>`).join('');

    const content = `
        <h2>✏️ تعديل فاتورة شراء (${pur.id})</h2>
        <br>
        <form action="/invoices/update-purchase/${pur.id}" method="POST" class="card">
            <div class="form-group">
                <label>اختر المجهز / المعمل</label>
                <select name="supplierId" required>
                    <option value="">اختر المجهز...</option>
                    ${supplierOpts}
                </select>
            </div>
            <div class="flex-gap">
                <div class="form-group" style="flex:2;">
                    <label>نوع المادة / الشحنة</label>
                    <input type="text" name="cementType" value="${pur.cementType || ''}" required>
                </div>
                <div class="form-group" style="flex:1;">
                    <label>وحدة القياس</label>
                    <select name="unit">
                        <option value="متر مكعب (م³)" ${pur.unit === 'متر مكعب (م³)' ? 'selected' : ''}>متر مكعب (م³)</option>
                        <option value="طن" ${pur.unit === 'طن' ? 'selected' : ''}>طن</option>
                        <option value="لتر" ${pur.unit === 'لتر' ? 'selected' : ''}>لتر</option>
                    </select>
                </div>
            </div>
            <div class="flex-gap">
                <div class="form-group" style="flex:1;">
                    <label>الكمية</label>
                    <input type="number" step="0.01" name="qty" id="qtyPur" value="${pur.qty}" required oninput="calcPurTotal()">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>سعر الوحدة (د.ع)</label>
                    <input type="number" name="price" id="pricePur" value="${pur.price}" required oninput="calcPurTotal()">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>المبلغ الإجمالي</label>
                    <input type="number" name="total" id="totalPur" value="${pur.total}" readonly style="background:#f1f5f9; font-weight:bold; color:var(--primary);">
                </div>
            </div>
            <div class="flex-gap">
                <div class="form-group" style="flex:1;">
                    <label>المبلغ الواصل (المدفوع للمجهز)</label>
                    <input type="number" name="paid" id="paidPur" value="${pur.paid}" oninput="calcPurTotal()">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>المبلغ المتبقي</label>
                    <input type="number" id="remainingPur" readonly style="background:#f1f5f9; font-weight:bold; color:var(--danger);">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>التاريخ</label>
                    <input type="date" name="date" value="${pur.date}" required>
                </div>
            </div>
            <div class="form-group">
                <label>ملاحظات تفصيلية</label>
                <textarea name="notes" rows="2">${pur.notes || ''}</textarea>
            </div>
            <div class="flex-gap">
                <button class="btn btn-success" style="flex:1;">تحديث وحفظ الفاتورة</button>
                <a href="/invoices?type=purchase" class="btn btn-secondary">إلغاء</a>
            </div>
        </form>

        <script>
            function calcPurTotal() {
                const q = parseFloat(document.getElementById('qtyPur').value) || 0;
                const p = parseFloat(document.getElementById('pricePur').value) || 0;
                const paid = parseFloat(document.getElementById('paidPur').value) || 0;
                const total = Math.round(q * p);
                document.getElementById('totalPur').value = total;
                document.getElementById('remainingPur').value = Math.round(total - paid);
            }
            window.onload = calcPurTotal;
        </script>
    `;

    res.send(renderLayout('تعديل فاتورة شراء', content, 'invoices'));
});

app.post('/invoices/update-purchase/:id', (req, res) => {
    const db = loadDB();
    const idx = db.purchases.findIndex(p => p.id === req.params.id);
    if (idx !== -1) {
        const supplier = db.suppliers.find(s => s.id == req.body.supplierId);
        const qty = Number(req.body.qty) || 0;
        const price = Number(req.body.price) || 0;
        const total = qty * price;

        db.purchases[idx] = {
            ...db.purchases[idx],
            supplierId: req.body.supplierId,
            supplierName: supplier ? supplier.name : 'مجهز غير مسجل',
            cementType: req.body.cementType,
            unit: req.body.unit || 'طن',
            qty: qty,
            price: price,
            total: total,
            paid: Number(req.body.paid) || 0,
            date: req.body.date,
            notes: req.body.notes
        };
        saveDB(db);
    }
    res.redirect('/invoices?type=purchase');
});

// --- حذف فاتورة شراء ---
app.get('/invoices/delete-purchase/:id', (req, res) => {
    const db = loadDB();
    db.purchases = db.purchases.filter(p => p.id !== req.params.id);
    saveDB(db);
    res.redirect('/invoices?type=purchase');
});

// --- عرض وتصدير فاتورة البيع ---
app.get('/invoices/view-sale/:id', (req, res) => {
    const db = loadDB();
    const inv = db.invoices.find(i => i.id === req.params.id);
    if (!inv) return res.send('الفاتورة غير موجودة');

    const customer = db.customers.find(c => c.id == inv.customerId);
    const textReceipt = generateSaleInvoiceText(inv);

    const whatsappUrl = customer && customer.phone
        ? `https://wa.me/${customer.phone}?text=${encodeURIComponent(textReceipt)}`
        : `https://wa.me/?text=${encodeURIComponent(textReceipt)}`;

    const content = `
        <h2>وصل فاتورة بيع رسمية - شركة البراء</h2>
        <br>
        <div class="card" id="printableArea">
            <pre style="white-space: pre-wrap; font-family: inherit; font-size: 14px; background:#f8fafc; padding:20px; border-radius:8px; line-height:1.6; border:1px solid #cbd5e0;">${textReceipt}</pre>
        </div>

        <div class="flex-gap no-print" style="margin-top:15px;">
            <button class="btn btn-success" onclick="navigator.clipboard.writeText(\`${textReceipt.replace(/`/g, '\\`')}\`); alert('تم نسخ الفاتورة بنجاح!');">📋 نسخ النص</button>
            <a href="${whatsappUrl}" target="_blank" class="btn btn-whatsapp">📲 إرسال عبر الواتساب</a>
            <button class="btn btn-secondary" onclick="window.print();">🖨️ طباعة الفاتورة فوراً</button>
            <a href="/invoices" class="btn btn-secondary">العودة للفواتير</a>
        </div>
    `;

    res.send(renderLayout('عرض فاتورة بيع', content, 'invoices'));
});

// --- عرض وتصدير فاتورة الشراء ---
app.get('/invoices/view-purchase/:id', (req, res) => {
    const db = loadDB();
    const pur = db.purchases.find(p => p.id === req.params.id);
    if (!pur) return res.send('فاتورة الشراء غير موجودة');

    const supplier = db.suppliers.find(s => s.id == pur.supplierId);
    pur.supplierName = supplier ? supplier.name : 'مجهز';
    const textReceipt = generatePurchaseInvoiceText(pur);

    const whatsappUrl = supplier && supplier.phone
        ? `https://wa.me/${supplier.phone}?text=${encodeURIComponent(textReceipt)}`
        : `https://wa.me/?text=${encodeURIComponent(textReceipt)}`;

    const content = `
        <h2>وصل فاتورة شراء رسمية - شركة البراء</h2>
        <br>
        <div class="card" id="printableArea">
            <pre style="white-space: pre-wrap; font-family: inherit; font-size: 14px; background:#f8fafc; padding:20px; border-radius:8px; line-height:1.6; border:1px solid #cbd5e0;">${textReceipt}</pre>
        </div>

        <div class="flex-gap no-print" style="margin-top:15px;">
            <button class="btn btn-success" onclick="navigator.clipboard.writeText(\`${textReceipt.replace(/`/g, '\\`')}\`); alert('تم نسخ النص بنجاح!');">📋 نسخ النص</button>
            <a href="${whatsappUrl}" target="_blank" class="btn btn-whatsapp">📲 إرسال للمجهز بالواتساب</a>
            <button class="btn btn-secondary" onclick="window.print();">🖨️ طباعة الفاتورة فوراً</button>
            <a href="/invoices" class="btn btn-secondary">العودة للفواتير</a>
        </div>
    `;

    res.send(renderLayout('عرض فاتورة شراء', content, 'invoices'));
});

// --- 3. قسم إدارة الزبائن، تسجيل البيع المباشر والكشوفات ---
app.get('/customers', (req, res) => {
    const db = loadDB();
    
    const rows = db.customers.map(c => {
        const invs = db.invoices.filter(i => i.customerId == c.id);
        const pays = db.customerPayments.filter(p => p.customerId == c.id);
        const tot = invs.reduce((a, b) => a + Number(b.total), 0);
        const pd = invs.reduce((a, b) => a + Number(b.paid), 0) + pays.reduce((a, b) => a + Number(b.amount), 0);
        const rem = tot - pd;

        return `
            <tr>
                <td><b>${c.name}</b></td>
                <td>${c.phone || '—'}</td>
                <td>${c.address || '—'}</td>
                <td>${invs.length} فاتورة</td>
                <td>${tot.toLocaleString()} د.ع</td>
                <td>${pd.toLocaleString()} د.ع</td>
                <td style="color:${rem>0?'var(--danger)':'var(--success)'}; font-weight:bold;">${rem.toLocaleString()} د.ع</td>
                <td>
                    <a href="/customers/account/${c.id}" class="btn" style="padding:4px 8px; font-size:11px;">كشف الحساب</a>
                    <a href="/customers/edit/${c.id}" class="btn btn-secondary" style="padding:4px 8px; font-size:11px;">تعديل</a>
                    <a href="/customers/delete/${c.id}" onclick="return confirm('هل أنت تأكد من حذف هذا الزبون؟')" class="btn btn-danger" style="padding:4px 8px; font-size:11px;">حذف</a>
                </td>
            </tr>
        `;
    }).join('');

    const customerOptions = db.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    const content = `
        <h2>إدارة الزبائن والعملاء</h2>
        <br>
        <div class="grid">
            <div class="card">
                <h3>إضافة زبون جديد</h3>
                <form action="/customers/add" method="POST" style="margin-top:10px;">
                    <div class="form-group"><input type="text" name="name" placeholder="اسم الزبون الكامل" required></div>
                    <div class="form-group"><input type="text" name="phone" placeholder="رقم الهاتف (مثال: 9647xxxxxxxxx)"></div>
                    <div class="form-group"><input type="text" name="address" placeholder="العنوان / الموقع"></div>
                    <div class="form-group"><input type="text" name="notes" placeholder="ملاحظات"></div>
                    <button class="btn btn-success" style="width:100%;">حفظ الزبون</button>
                </form>
            </div>

            <div class="card">
                <h3>بيع مباشر وتسجيل فاتورة لزبون</h3>
                <form action="/customers/quick-sale" method="POST" style="margin-top:10px;">
                    <div class="form-group">
                        <select name="customerId" required>
                            <option value="">اختر الزبون...</option>
                            ${customerOptions}
                        </select>
                    </div>
                    <div class="flex-gap">
                        <div class="form-group" style="flex:2;"><input type="text" name="cementType" placeholder="المادة (مثال: كونكريت)" required></div>
                        <div class="form-group" style="flex:1;">
                            <select name="unit">
                                <option value="متر مكعب (م³)">م³</option>
                                <option value="طن" selected>طن</option>
                                <option value="لتر">لتر</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex-gap">
                        <div class="form-group" style="flex:1;"><input type="number" step="0.01" name="qty" placeholder="الكمية" required></div>
                        <div class="form-group" style="flex:1;"><input type="number" name="price" placeholder="سعر الوحدة" required></div>
                    </div>
                    <div class="flex-gap">
                        <div class="form-group" style="flex:1;"><input type="number" name="paid" placeholder="الواصل" value="0"></div>
                        <div class="form-group" style="flex:1;"><input type="date" name="date" value="${getTodayDate()}" required></div>
                    </div>
                    <button class="btn btn-success" style="width:100%;">إتمام البيع وتوليد الفاتورة</button>
                </form>
            </div>
        </div>

        <h3>سجل الزبائن الحالية</h3>
        <table>
            <thead>
                <tr>
                    <th>اسم الزبون</th>
                    <th>الهاتف</th>
                    <th>العنوان</th>
                    <th>الفواتير</th>
                    <th>إجمالي المشتريات</th>
                    <th>إجمالي الواصل</th>
                    <th>المتبقي الصافي</th>
                    <th>الإجراء</th>
                </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="8" style="text-align:center;">لا يوجد زبائن مسجلين حالياً</td></tr>'}</tbody>
        </table>
    `;

    res.send(renderLayout('الزبائن والعملاء', content, 'customers'));
});

app.post('/customers/add', (req, res) => {
    const db = loadDB();
    db.customers.push({
        id: Date.now(),
        name: req.body.name,
        phone: req.body.phone,
        address: req.body.address,
        notes: req.body.notes
    });
    saveDB(db);
    res.redirect('/customers');
});

// --- تعديل زبون ---
app.get('/customers/edit/:id', (req, res) => {
    const db = loadDB();
    const customer = db.customers.find(c => c.id == req.params.id);
    if (!customer) return res.send('الزبون غير موجود');

    const content = `
        <h2>✏️ تعديل بيانات الزبون</h2>
        <br>
        <form action="/customers/update/${customer.id}" method="POST" class="card">
            <div class="form-group">
                <label>اسم الزبون الكامل</label>
                <input type="text" name="name" value="${customer.name}" required>
            </div>
            <div class="form-group">
                <label>رقم الهاتف</label>
                <input type="text" name="phone" value="${customer.phone || ''}">
            </div>
            <div class="form-group">
                <label>العنوان / الموقع</label>
                <input type="text" name="address" value="${customer.address || ''}">
            </div>
            <div class="form-group">
                <label>ملاحظات</label>
                <input type="text" name="notes" value="${customer.notes || ''}">
            </div>
            <div class="flex-gap">
                <button class="btn btn-success" style="flex:1;">حفظ التعديلات</button>
                <a href="/customers" class="btn btn-secondary">إلغاء</a>
            </div>
        </form>
    `;

    res.send(renderLayout('تعديل زبون', content, 'customers'));
});

app.post('/customers/update/:id', (req, res) => {
    const db = loadDB();
    const idx = db.customers.findIndex(c => c.id == req.params.id);
    if (idx !== -1) {
        db.customers[idx] = {
            ...db.customers[idx],
            name: req.body.name,
            phone: req.body.phone,
            address: req.body.address,
            notes: req.body.notes
        };
        saveDB(db);
    }
    res.redirect('/customers');
});

// --- حذف زبون ---
app.get('/customers/delete/:id', (req, res) => {
    const db = loadDB();
    db.customers = db.customers.filter(c => c.id != req.params.id);
    saveDB(db);
    res.redirect('/customers');
});

app.post('/customers/quick-sale', (req, res) => {
    const db = loadDB();
    const customer = db.customers.find(c => c.id == req.body.customerId);
    const qty = Number(req.body.qty) || 0;
    const price = Number(req.body.price) || 0;
    const total = qty * price;

    const newInv = {
        id: 'SALE-' + Date.now().toString().slice(-6),
        customerId: req.body.customerId,
        customerName: customer ? customer.name : 'زبون غير مسجل',
        cementType: req.body.cementType,
        unit: req.body.unit || 'طن',
        delegateName: '',
        driverName: '',
        vehicleNumber: '',
        cadre: '',
        date: req.body.date,
        qty: qty,
        price: price,
        total: total,
        paid: Number(req.body.paid) || 0,
        notes: 'بيع مباشر من صفحة الزبائن'
    };

    db.invoices.push(newInv);
    saveDB(db);

    res.redirect(`/invoices/view-sale/${newInv.id}`);
});

app.get('/customers/account/:id', (req, res) => {
    const db = loadDB();
    const customer = db.customers.find(c => c.id == req.params.id);
    if (!customer) return res.send('الزبون غير موجود');

    const invs = db.invoices.filter(i => i.customerId == customer.id);
    const pays = db.customerPayments.filter(p => p.customerId == customer.id);

    const totalDebts = invs.reduce((a, b) => a + Number(b.total), 0);
    const totalPaid = invs.reduce((a, b) => a + Number(b.paid), 0) + pays.reduce((a, b) => a + Number(b.amount), 0);
    const remaining = totalDebts - totalPaid;

    const paysRows = pays.map(p => `
        <tr>
            <td>${p.date}</td>
            <td style="color:var(--success); font-weight:bold;">${Number(p.amount).toLocaleString()} د.ع</td>
            <td>${p.notes || '—'}</td>
        </tr>
    `).join('');

    const invRows = invs.map(i => {
        const text = generateSaleInvoiceText(i);
        const waUrl = customer.phone ? `https://wa.me/${customer.phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
        return `
        <tr>
            <td>${i.id}</td>
            <td>${i.date}</td>
            <td>${i.cementType} (${i.qty} ${i.unit||'طن'})</td>
            <td>${Number(i.total).toLocaleString()} د.ع</td>
            <td>${Number(i.paid).toLocaleString()} د.ع</td>
            <td>
                <a href="/invoices/view-sale/${i.id}" class="btn" style="padding:2px 6px; font-size:11px;">عرض/طباعة</a>
                <a href="${waUrl}" target="_blank" class="btn btn-whatsapp" style="padding:2px 6px; font-size:11px;">📲 واتساب</a>
            </td>
        </tr>
    `}).join('');

    const content = `
        <h2>كشف حساب تفصيلي الزبون: ${customer.name} (شركة البراء)</h2>
        <p style="color:#64748b; margin-top:5px;">📞 ${customer.phone || 'بلا هاتف'} | 📍 ${customer.address || 'بلا عنوان'}</p>
        <br>
        <div class="grid">
            <div class="card"><h3>عدد الفواتير</h3><div class="val">${invs.length}</div></div>
            <div class="card"><h3>إجمالي الديون</h3><div class="val">${totalDebts.toLocaleString()} د.ع</div></div>
            <div class="card"><h3>إجمالي المسدد</h3><div class="val" style="color:var(--success);">${totalPaid.toLocaleString()} د.ع</div></div>
            <div class="card"><h3>المتبقي القائم</h3><div class="val" style="color:var(--danger);">${remaining.toLocaleString()} د.ع</div></div>
        </div>

        <div class="card no-print">
            <h3>تسجيل دفعة تسديد نقدية من الزبون</h3>
            <form action="/customers/pay" method="POST" class="flex-gap" style="margin-top:10px;">
                <input type="hidden" name="customerId" value="${customer.id}">
                <input type="number" name="amount" placeholder="مبلغ التسديد المقبوض" required style="flex:1;">
                <input type="date" name="date" value="${getTodayDate()}" required style="flex:1;">
                <input type="text" name="notes" placeholder="ملاحظات أو رقم وصل التسديد" style="flex:1;">
                <button class="btn btn-success">حفظ المقبوضات</button>
            </form>
        </div>

        <div class="grid">
            <div>
                <h3>سجل فواتير الزبون</h3>
                <table>
                    <thead><tr><th>رقم الوصل</th><th>التاريخ</th><th>المادة</th><th>الإجمالي</th><th>الواصل</th><th>إجراء</th></tr></thead>
                    <tbody>${invRows || '<tr><td colspan="6" style="text-align:center;">لا توجد فواتير مسجلة</td></tr>'}</tbody>
                </table>
            </div>
            <div>
                <h3>سجل دفعات التسديد المقبوضة</h3>
                <table>
                    <thead><tr><th>التاريخ</th><th>المبلغ المسدد</th><th>ملاحظات</th></tr></thead>
                    <tbody>${paysRows || '<tr><td colspan="3" style="text-align:center;">لا توجد دفعات مسجلة</td></tr>'}</tbody>
                </table>
            </div>
        </div>
    `;

    res.send(renderLayout('كشف حساب زبون', content, 'customers'));
});

app.post('/customers/pay', (req, res) => {
    const db = loadDB();
    db.customerPayments.push({
        id: Date.now(),
        customerId: req.body.customerId,
        amount: Number(req.body.amount),
        date: req.body.date,
        notes: req.body.notes
    });
    saveDB(db);
    res.redirect(`/customers/account/${req.body.customerId}`);
});

// --- 4. قسم المجهزين والمشتريات ---
app.get('/suppliers', (req, res) => {
    const db = loadDB();
    const supplierOpts = db.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    const rows = db.suppliers.map(s => {
        const pur = db.purchases.filter(p => p.supplierId == s.id);
        const pays = db.supplierPayments.filter(p => p.supplierId == s.id);
        const tot = pur.reduce((a, b) => a + Number(b.total), 0);
        const pd = pur.reduce((a, b) => a + Number(b.paid), 0) + pays.reduce((a, b) => a + Number(b.amount), 0);
        const rem = tot - pd;

        return `
            <tr>
                <td><b>${s.name}</b></td>
                <td>${s.phone || '—'}</td>
                <td>${s.address || '—'}</td>
                <td>${tot.toLocaleString()} د.ع</td>
                <td>${pd.toLocaleString()} د.ع</td>
                <td style="color:${rem>0?'var(--danger)':'var(--success)'}; font-weight:bold;">${rem.toLocaleString()} د.ع</td>
                <td>
                    <a href="/suppliers/edit/${s.id}" class="btn btn-secondary" style="padding:3px 6px; font-size:11px;">تعديل</a>
                    <a href="/suppliers/delete/${s.id}" onclick="return confirm('هل أنت تأكد من حذف هذا المجهز؟')" class="btn btn-danger" style="padding:3px 6px; font-size:11px;">حذف</a>
                </td>
            </tr>
        `;
    }).join('');

    const content = `
        <h2>إدارة المجهزين والشركات المعملية</h2>
        <br>
        <div class="grid">
            <div class="card">
                <h3>إضافة مجهز جديد</h3>
                <form action="/suppliers/add" method="POST" style="margin-top:10px;">
                    <div class="form-group"><input type="text" name="name" placeholder="اسم المجهز أو الشركة" required></div>
                    <div class="form-group"><input type="text" name="phone" placeholder="رقم الهاتف"></div>
                    <div class="form-group"><input type="text" name="address" placeholder="العنوان / المحافظة"></div>
                    <div class="form-group"><input type="text" name="notes" placeholder="ملاحظات"></div>
                    <button class="btn btn-success" style="width:100%;">حفظ المجهز</button>
                </form>
            </div>
            <div class="card">
                <h3>تسجيل شراء سريع من مجهز</h3>
                <form action="/purchases/add" method="POST" style="margin-top:10px;">
                    <div class="form-group">
                        <select name="supplierId" required>
                            <option value="">اختر المجهز...</option>
                            ${supplierOpts}
                        </select>
                    </div>
                    <div class="flex-gap">
                        <div class="form-group" style="flex:2;"><input type="text" name="cementType" placeholder="المادة" required></div>
                        <div class="form-group" style="flex:1;">
                            <select name="unit">
                                <option value="متر مكعب (م³)">م³</option>
                                <option value="طن" selected>طن</option>
                                <option value="لتر">لتر</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex-gap">
                        <div class="form-group" style="flex:1;"><input type="number" step="0.01" name="qty" placeholder="الكمية" required></div>
                        <div class="form-group" style="flex:1;"><input type="number" name="price" placeholder="سعر الوحدة" required></div>
                    </div>
                    <div class="flex-gap">
                        <div class="form-group" style="flex:1;"><input type="number" name="paid" placeholder="المدفوع للمجهز" value="0"></div>
                        <div class="form-group" style="flex:1;"><input type="date" name="date" value="${getTodayDate()}" required></div>
                    </div>
                    <button class="btn btn-success" style="width:100%;">حفظ الفاتورة وتحديث الحساب</button>
                </form>
            </div>
        </div>

        <h3>قائمة المجهزين</h3>
        <table>
            <thead>
                <tr>
                    <th>اسم المجهز</th>
                    <th>الهاتف</th>
                    <th>العنوان</th>
                    <th>إجمالي الشراء</th>
                    <th>إجمالي المدفوع</th>
                    <th>المتبقي للمجهز</th>
                    <th>الإجراء</th>
                </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="7" style="text-align:center;">لا توجد مجهزين مسجلين</td></tr>'}</tbody>
        </table>
    `;

    res.send(renderLayout('المجهزين', content, 'suppliers'));
});

app.post('/suppliers/add', (req, res) => {
    const db = loadDB();
    db.suppliers.push({
        id: Date.now(),
        name: req.body.name,
        phone: req.body.phone,
        address: req.body.address,
        notes: req.body.notes
    });
    saveDB(db);
    res.redirect('/suppliers');
});

// --- تعديل مجهز ---
app.get('/suppliers/edit/:id', (req, res) => {
    const db = loadDB();
    const supplier = db.suppliers.find(s => s.id == req.params.id);
    if (!supplier) return res.send('المجهز غير موجود');

    const content = `
        <h2>✏️ تعديل بيانات المجهز</h2>
        <br>
        <form action="/suppliers/update/${supplier.id}" method="POST" class="card">
            <div class="form-group">
                <label>اسم المجهز أو الشركة</label>
                <input type="text" name="name" value="${supplier.name}" required>
            </div>
            <div class="form-group">
                <label>رقم الهاتف</label>
                <input type="text" name="phone" value="${supplier.phone || ''}">
            </div>
            <div class="form-group">
                <label>العنوان / المحافظة</label>
                <input type="text" name="address" value="${supplier.address || ''}">
            </div>
            <div class="form-group">
                <label>ملاحظات</label>
                <input type="text" name="notes" value="${supplier.notes || ''}">
            </div>
            <div class="flex-gap">
                <button class="btn btn-success" style="flex:1;">حفظ التعديلات</button>
                <a href="/suppliers" class="btn btn-secondary">إلغاء</a>
            </div>
        </form>
    `;

    res.send(renderLayout('تعديل مجهز', content, 'suppliers'));
});

app.post('/suppliers/update/:id', (req, res) => {
    const db = loadDB();
    const idx = db.suppliers.findIndex(s => s.id == req.params.id);
    if (idx !== -1) {
        db.suppliers[idx] = {
            ...db.suppliers[idx],
            name: req.body.name,
            phone: req.body.phone,
            address: req.body.address,
            notes: req.body.notes
        };
        saveDB(db);
    }
    res.redirect('/suppliers');
});

// --- حذف مجهز ---
app.get('/suppliers/delete/:id', (req, res) => {
    const db = loadDB();
    db.suppliers = db.suppliers.filter(s => s.id != req.params.id);
    saveDB(db);
    res.redirect('/suppliers');
});

app.post('/purchases/add', (req, res) => {
    const db = loadDB();
    const supplier = db.suppliers.find(s => s.id == req.body.supplierId);
    const qty = Number(req.body.qty) || 0;
    const price = Number(req.body.price) || 0;
    const total = qty * price;

    const newPur = {
        id: 'PUR-' + Date.now().toString().slice(-6),
        supplierId: req.body.supplierId,
        supplierName: supplier ? supplier.name : 'مجهز غير مسجل',
        cementType: req.body.cementType,
        unit: req.body.unit || 'طن',
        qty: qty,
        price: price,
        total: total,
        paid: Number(req.body.paid) || 0,
        date: req.body.date
    };

    db.purchases.push(newPur);
    saveDB(db);

    res.redirect(`/invoices/view-purchase/${newPur.id}`);
});

// --- 5. إدارة أساطيل النقل ---
app.get('/fleet', (req, res) => {
    const db = loadDB();

    const driverRows = db.drivers.map(d => `
        <tr>
            <td><b>${d.name}</b></td>
            <td>${d.phone || '—'}</td>
            <td>${d.notes || '—'}</td>
            <td><a href="/drivers/delete/${d.id}" class="btn btn-danger" style="padding:3px 6px; font-size:11px;">حذف</a></td>
        </tr>
    `).join('');

    const vehicleRows = db.vehicles.map(v => `
        <tr>
            <td><b>${v.number}</b></td>
            <td>${v.notes || '—'}</td>
            <td><a href="/vehicles/delete/${v.id}" class="btn btn-danger" style="padding:3px 6px; font-size:11px;">حذف</a></td>
        </tr>
    `).join('');

    const content = `
        <h2>إدارة أساطيل النقل (السائقين والمركبات)</h2>
        <br>
        <div class="grid">
            <div class="card">
                <h3>إضافة سائق جديد</h3>
                <form action="/drivers/add" method="POST" style="margin-top:10px;">
                    <div class="form-group"><input type="text" name="name" placeholder="اسم السائق الثلاثي" required></div>
                    <div class="form-group"><input type="text" name="phone" placeholder="رقم الهاتف"></div>
                    <div class="form-group"><input type="text" name="notes" placeholder="ملاحظات"></div>
                    <button class="btn btn-success" style="width:100%;">حفظ السائق</button>
                </form>
            </div>
            <div class="card">
                <h3>إضافة مركبة / خلاطة جديدة</h3>
                <form action="/vehicles/add" method="POST" style="margin-top:10px;">
                    <div class="form-group"><input type="text" name="number" placeholder="رقم المركبة" required></div>
                    <div class="form-group"><input type="text" name="notes" placeholder="تفاصيل المركبة"></div>
                    <button class="btn btn-success" style="width:100%;">حفظ المركبة</button>
                </form>
            </div>
        </div>

        <div class="grid">
            <div>
                <h3>سجل السائقين</h3>
                <table>
                    <thead><tr><th>الاسم</th><th>الهاتف</th><th>ملاحظات</th><th>إجراء</th></tr></thead>
                    <tbody>${driverRows || '<tr><td colspan="4" style="text-align:center;">لا يوجد سائقين</td></tr>'}</tbody>
                </table>
            </div>
            <div>
                <h3>سجل المركبات</h3>
                <table>
                    <thead><tr><th>رقم المركبة</th><th>ملاحظات</th><th>إجراء</th></tr></thead>
                    <tbody>${vehicleRows || '<tr><td colspan="3" style="text-align:center;">لا توجد مركبات</td></tr>'}</tbody>
                </table>
            </div>
        </div>
    `;

    res.send(renderLayout('إدارة النقل', content, 'fleet'));
});

app.post('/drivers/add', (req, res) => {
    const db = loadDB();
    db.drivers.push({ id: Date.now(), name: req.body.name, phone: req.body.phone, notes: req.body.notes });
    saveDB(db);
    res.redirect('/fleet');
});

app.get('/drivers/delete/:id', (req, res) => {
    const db = loadDB();
    db.drivers = db.drivers.filter(d => d.id != req.params.id);
    saveDB(db);
    res.redirect('/fleet');
});

app.post('/vehicles/add', (req, res) => {
    const db = loadDB();
    db.vehicles.push({ id: Date.now(), number: req.body.number, notes: req.body.notes });
    saveDB(db);
    res.redirect('/fleet');
});

app.get('/vehicles/delete/:id', (req, res) => {
    const db = loadDB();
    db.vehicles = db.vehicles.filter(v => v.id != req.params.id);
    saveDB(db);
    res.redirect('/fleet');
});

// --- 6. إدارة الموظفين ---
app.get('/employees', (req, res) => {
    const db = loadDB();

    const rows = db.employees.map(e => `
        <tr>
            <td><b>${e.name}</b></td>
            <td>${e.title}</td>
            <td>${e.phone || '—'}</td>
            <td>${e.address || '—'}</td>
            <td>${Number(e.salary).toLocaleString()} د.ع</td>
            <td>${Number(e.takenSalary || 0).toLocaleString()} د.ع</td>
            <td style="color:var(--danger); font-weight:bold;">${(Number(e.salary) - Number(e.takenSalary || 0)).toLocaleString()} د.ع</td>
            <td>
                <a href="/employees/edit/${e.id}" class="btn btn-secondary" style="padding:3px 6px; font-size:11px;">تعديل</a>
                <a href="/employees/delete/${e.id}" class="btn btn-danger" style="padding:3px 6px; font-size:11px;">حذف</a>
            </td>
        </tr>
    `).join('');

    const content = `
        <h2>إدارة الكادر والموظفين والرواتب</h2>
        <br>
        <div class="card">
            <h3>إضافة موظف جديد</h3>
            <form action="/employees/add" method="POST" class="flex-gap" style="margin-top:10px;">
                <input type="text" name="name" placeholder="اسم الموظف" required style="flex:1;">
                <input type="text" name="title" placeholder="المسمى الوظيفي" required style="flex:1;">
                <input type="text" name="phone" placeholder="الهاتف" style="flex:1;">
                <input type="text" name="address" placeholder="العنوان" style="flex:1;">
                <input type="number" name="salary" placeholder="الراتب المحدد" required style="flex:1;">
                <input type="number" name="takenSalary" placeholder="المستلم" value="0" style="flex:1;">
                <button class="btn btn-success">حفظ الموظف</button>
            </form>
        </div>

        <table>
            <thead>
                <tr>
                    <th>الموظف</th>
                    <th>الوظيفة</th>
                    <th>الهاتف</th>
                    <th>السكن</th>
                    <th>الراتب الكلي</th>
                    <th>المستلم</th>
                    <th>المتبقي</th>
                    <th>الإجراء</th>
                </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="8" style="text-align:center;">لا يوجد موظفين</td></tr>'}</tbody>
        </table>
    `;

    res.send(renderLayout('الموظفين', content, 'employees'));
});

app.post('/employees/add', (req, res) => {
    const db = loadDB();
    db.employees.push({
        id: Date.now(),
        name: req.body.name,
        title: req.body.title,
        phone: req.body.phone,
        address: req.body.address,
        salary: Number(req.body.salary),
        takenSalary: Number(req.body.takenSalary) || 0
    });
    saveDB(db);
    res.redirect('/employees');
});

// --- تعديل موظف ---
app.get('/employees/edit/:id', (req, res) => {
    const db = loadDB();
    const emp = db.employees.find(e => e.id == req.params.id);
    if (!emp) return res.send('الموظف غير موجود');

    const content = `
        <h2>✏️ تعديل بيانات الموظف</h2>
        <br>
        <form action="/employees/update/${emp.id}" method="POST" class="card">
            <div class="form-group">
                <label>اسم الموظف</label>
                <input type="text" name="name" value="${emp.name}" required>
            </div>
            <div class="form-group">
                <label>المسمى الوظيفي</label>
                <input type="text" name="title" value="${emp.title}" required>
            </div>
            <div class="flex-gap">
                <div class="form-group" style="flex:1;">
                    <label>الهاتف</label>
                    <input type="text" name="phone" value="${emp.phone || ''}">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>العنوان</label>
                    <input type="text" name="address" value="${emp.address || ''}">
                </div>
            </div>
            <div class="flex-gap">
                <div class="form-group" style="flex:1;">
                    <label>الراتب المحدد</label>
                    <input type="number" name="salary" value="${emp.salary}" required>
                </div>
                <div class="form-group" style="flex:1;">
                    <label>المستلم</label>
                    <input type="number" name="takenSalary" value="${emp.takenSalary || 0}">
                </div>
            </div>
            <div class="flex-gap">
                <button class="btn btn-success" style="flex:1;">حفظ التعديلات</button>
                <a href="/employees" class="btn btn-secondary">إلغاء</a>
            </div>
        </form>
    `;

    res.send(renderLayout('تعديل موظف', content, 'employees'));
});

app.post('/employees/update/:id', (req, res) => {
    const db = loadDB();
    const idx = db.employees.findIndex(e => e.id == req.params.id);
    if (idx !== -1) {
        db.employees[idx] = {
            ...db.employees[idx],
            name: req.body.name,
            title: req.body.title,
            phone: req.body.phone,
            address: req.body.address,
            salary: Number(req.body.salary),
            takenSalary: Number(req.body.takenSalary) || 0
        };
        saveDB(db);
    }
    res.redirect('/employees');
});

app.get('/employees/delete/:id', (req, res) => {
    const db = loadDB();
    db.employees = db.employees.filter(e => e.id != req.params.id);
    saveDB(db);
    res.redirect('/employees');
});

// --- 7. المصاريف (إضافة، تعديل، وحذف) ---
app.get('/expenses', (req, res) => {
    const db = loadDB();

    const rows = db.expenses.map(e => `
        <tr>
            <td>${e.date}</td>
            <td><span class="btn btn-secondary" style="padding:2px 6px; font-size:11px;">${e.category}</span></td>
            <td><b>${e.title}</b></td>
            <td style="color:var(--danger); font-weight:bold;">${Number(e.amount).toLocaleString()} د.ع</td>
            <td>${e.notes || '—'}</td>
            <td>
                <a href="/expenses/edit/${e.id}" class="btn btn-secondary" style="padding:3px 6px; font-size:11px;">تعديل</a>
                <a href="/expenses/delete/${e.id}" onclick="return confirm('هل أنت تأكد من حذف هذا المصروف؟')" class="btn btn-danger" style="padding:3px 6px; font-size:11px;">حذف</a>
            </td>
        </tr>
    `).join('');

    const content = `
        <h2>إدارة المصاريف التشغيلية (شركة البراء)</h2>
        <br>
        <div class="card">
            <h3>تسجيل مصروف تشغيلي جديد</h3>
            <form action="/expenses/add" method="POST" class="flex-gap" style="margin-top:10px;">
                <input type="text" name="category" placeholder="التصنيف (وقود، صيانة، إيجار...)" required style="flex:1;">
                <input type="text" name="title" placeholder="عنوان المصروف" required style="flex:1;">
                <input type="number" name="amount" placeholder="المبلغ" required style="flex:1;">
                <input type="date" name="date" value="${getTodayDate()}" required style="flex:1;">
                <input type="text" name="notes" placeholder="ملاحظات" style="flex:1;">
                <button class="btn btn-success">حفظ المصروف</button>
            </form>
        </div>

        <table>
            <thead>
                <tr>
                    <th>التاريخ</th>
                    <th>التصنيف</th>
                    <th>البيان</th>
                    <th>المبلغ</th>
                    <th>الملاحظات</th>
                    <th>الإجراء</th>
                </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="6" style="text-align:center;">لا توجد مصاريف مسجلة</td></tr>'}</tbody>
        </table>
    `;

    res.send(renderLayout('المصاريف', content, 'expenses'));
});

app.post('/expenses/add', (req, res) => {
    const db = loadDB();
    db.expenses.push({
        id: Date.now(),
        category: req.body.category,
        title: req.body.title,
        amount: Number(req.body.amount),
        date: req.body.date,
        notes: req.body.notes
    });
    saveDB(db);
    res.redirect('/expenses');
});

// --- تعديل مصروف ---
app.get('/expenses/edit/:id', (req, res) => {
    const db = loadDB();
    const exp = db.expenses.find(e => e.id == req.params.id);
    if (!exp) return res.send('المصروف غير موجود');

    const content = `
        <h2>✏️ تعديل المصروف التشغيلي</h2>
        <br>
        <form action="/expenses/update/${exp.id}" method="POST" class="card">
            <div class="form-group">
                <label>التصنيف</label>
                <input type="text" name="category" value="${exp.category}" required>
            </div>
            <div class="form-group">
                <label>عنوان المصروف / البيان</label>
                <input type="text" name="title" value="${exp.title}" required>
            </div>
            <div class="flex-gap">
                <div class="form-group" style="flex:1;">
                    <label>المبلغ (د.ع)</label>
                    <input type="number" name="amount" value="${exp.amount}" required>
                </div>
                <div class="form-group" style="flex:1;">
                    <label>التاريخ</label>
                    <input type="date" name="date" value="${exp.date}" required>
                </div>
            </div>
            <div class="form-group">
                <label>ملاحظات</label>
                <input type="text" name="notes" value="${exp.notes || ''}">
            </div>
            <div class="flex-gap">
                <button class="btn btn-success" style="flex:1;">حفظ التعديلات</button>
                <a href="/expenses" class="btn btn-secondary">إلغاء</a>
            </div>
        </form>
    `;

    res.send(renderLayout('تعديل مصروف', content, 'expenses'));
});

app.post('/expenses/update/:id', (req, res) => {
    const db = loadDB();
    const idx = db.expenses.findIndex(e => e.id == req.params.id);
    if (idx !== -1) {
        db.expenses[idx] = {
            ...db.expenses[idx],
            category: req.body.category,
            title: req.body.title,
            amount: Number(req.body.amount),
            date: req.body.date,
            notes: req.body.notes
        };
        saveDB(db);
    }
    res.redirect('/expenses');
});

// --- حذف مصروف ---
app.get('/expenses/delete/:id', (req, res) => {
    const db = loadDB();
    db.expenses = db.expenses.filter(e => e.id != req.params.id);
    saveDB(db);
    res.redirect('/expenses');
});

// --- 8. التقارير المالية والتحليلية ---
app.get('/reports', (req, res) => {
    const db = loadDB();
    const { period } = req.query;

    let filteredInvoices = db.invoices;
    let filteredPurchases = db.purchases;
    let filteredExpenses = db.expenses;
    let filteredCustomerPayments = db.customerPayments;
    let filteredSupplierPayments = db.supplierPayments;

    const today = getTodayDate();
    const currentMonth = today.slice(0, 7);
    const currentYear = today.slice(0, 4);

    if (period === 'daily') {
        filteredInvoices = db.invoices.filter(i => i.date === today);
        filteredPurchases = db.purchases.filter(p => p.date === today);
        filteredExpenses = db.expenses.filter(e => e.date === today);
        filteredCustomerPayments = db.customerPayments.filter(p => p.date === today);
        filteredSupplierPayments = db.supplierPayments.filter(p => p.date === today);
    } else if (period === 'yearly') {
        filteredInvoices = db.invoices.filter(i => i.date && i.date.startsWith(currentYear));
        filteredPurchases = db.purchases.filter(p => p.date && p.date.startsWith(currentYear));
        filteredExpenses = db.expenses.filter(e => e.date && e.date.startsWith(currentYear));
        filteredCustomerPayments = db.customerPayments.filter(p => p.date && p.date.startsWith(currentYear));
        filteredSupplierPayments = db.supplierPayments.filter(p => p.date && p.date.startsWith(currentYear));
    } else {
        filteredInvoices = db.invoices.filter(i => i.date && i.date.startsWith(currentMonth));
        filteredPurchases = db.purchases.filter(p => p.date && p.date.startsWith(currentMonth));
        filteredExpenses = db.expenses.filter(e => e.date && e.date.startsWith(currentMonth));
        filteredCustomerPayments = db.customerPayments.filter(p => p.date && p.date.startsWith(currentMonth));
        filteredSupplierPayments = db.supplierPayments.filter(p => p.date && p.date.startsWith(currentMonth));
    }

    const totalSales = filteredInvoices.reduce((a, b) => a + Number(b.total), 0);
    const totalPaidFromInvoices = filteredInvoices.reduce((a, b) => a + Number(b.paid), 0);
    const totalCustomerPaid = totalPaidFromInvoices + filteredCustomerPayments.reduce((a, b) => a + Number(b.amount), 0);

    const totalPurchases = filteredPurchases.reduce((a, b) => a + Number(b.total), 0);
    const totalPaidFromPurchases = filteredPurchases.reduce((a, b) => a + Number(b.paid), 0);
    const totalSupplierPaid = totalPaidFromPurchases + filteredSupplierPayments.reduce((a, b) => a + Number(b.amount), 0);

    const totalExpenses = filteredExpenses.reduce((a, b) => a + Number(b.amount), 0);

    const totalCustomerDebts = db.customers.reduce((acc, c) => {
        const invs = db.invoices.filter(i => i.customerId == c.id);
        const pays = db.customerPayments.filter(p => p.customerId == c.id);
        const tot = invs.reduce((a, b) => a + Number(b.total), 0);
        const pd = invs.reduce((a, b) => a + Number(b.paid), 0) + pays.reduce((a, b) => a + Number(b.amount), 0);
        return acc + (tot - pd);
    }, 0);

    const totalSupplierDebts = db.suppliers.reduce((acc, s) => {
        const pur = db.purchases.filter(p => p.supplierId == s.id);
        const pays = db.supplierPayments.filter(p => p.supplierId == s.id);
        const tot = pur.reduce((a, b) => a + Number(b.total), 0);
        const pd = pur.reduce((a, b) => a + Number(b.paid), 0) + pays.reduce((a, b) => a + Number(b.amount), 0);
        return acc + (tot - pd);
    }, 0);

    const cashIn = totalCustomerPaid;
    const cashOut = totalSupplierPaid + totalExpenses;
    const netCashMovement = cashIn - cashOut;
    const netProfitEst = totalSales - totalPurchases - totalExpenses;

    const reportText = `*📊 التقارير المالية الشاملة - شركة البراء*
الفترة: ${period || 'monthly (الشهر الحالي)'}
----------------------------------
*إجمالي المبيعات:* ${totalSales.toLocaleString()} د.ع
*الواصل من الزبائن:* ${totalCustomerPaid.toLocaleString()} د.ع
*ديون الزبائن المتبقية:* ${totalCustomerDebts.toLocaleString()} د.ع
----------------------------------
*إجمالي المشتريات:* ${totalPurchases.toLocaleString()} د.ع
*المدفوع للمجهزين:* ${totalSupplierPaid.toLocaleString()} د.ع
*ديون المجهزين المتبقية:* ${totalSupplierDebts.toLocaleString()} د.ع
----------------------------------
*المصاريف التشغيلية:* ${totalExpenses.toLocaleString()} د.ع
*الداخل النقدي:* ${cashIn.toLocaleString()} د.ع
*الخارج النقدي:* ${cashOut.toLocaleString()} د.ع
*صافي الحركة النقدية:* ${netCashMovement.toLocaleString()} د.ع
*الربح التقديري الصافي:* ${netProfitEst.toLocaleString()} د.ع`;

    const content = `
        <h2>التقارير المالية والتحليلية الشاملة - شركة البراء</h2>
        <br>
        <div class="card flex-gap">
            <a href="/reports?period=daily" class="btn ${period==='daily'?'':'btn-secondary'}">تقرير اليوم</a>
            <a href="/reports?period=monthly" class="btn ${!period||period==='monthly'?'':'btn-secondary'}">تقرير الشهر الحالي</a>
            <a href="/reports?period=yearly" class="btn ${period==='yearly'?'':'btn-secondary'}">تقرير السنة الحالية</a>
        </div>

        <div class="grid" style="margin-top:15px;">
            <div class="card"><h3>إجمالي المبيعات</h3><div class="val">${totalSales.toLocaleString()} د.ع</div></div>
            <div class="card"><h3>الواصل من الزبائن</h3><div class="val" style="color:var(--success);">${totalCustomerPaid.toLocaleString()} د.ع</div></div>
            <div class="card"><h3>ديون الزبائن المتبقية</h3><div class="val" style="color:var(--danger);">${totalCustomerDebts.toLocaleString()} د.ع</div></div>
            <div class="card"><h3>إجمالي المشتريات</h3><div class="val">${totalPurchases.toLocaleString()} د.ع</div></div>
            <div class="card"><h3>المدفوع للمجهزين</h3><div class="val" style="color:var(--danger);">${totalSupplierPaid.toLocaleString()} د.ع</div></div>
            <div class="card"><h3>ديون المجهزين المتبقية</h3><div class="val">${totalSupplierDebts.toLocaleString()} د.ع</div></div>
            <div class="card"><h3>المصاريف التشغيلية</h3><div class="val" style="color:var(--danger);">${totalExpenses.toLocaleString()} د.ع</div></div>
            <div class="card"><h3>الداخل النقدي</h3><div class="val" style="color:var(--success);">${cashIn.toLocaleString()} د.ع</div></div>
            <div class="card"><h3>الخارج النقدي</h3><div class="val" style="color:var(--danger);">${cashOut.toLocaleString()} د.ع</div></div>
            <div class="card"><h3>صافي الحركة النقدية</h3><div class="val" style="color:${netCashMovement >= 0 ? 'var(--success)' : 'var(--danger)'}">${netCashMovement.toLocaleString()} د.ع</div></div>
            <div class="card"><h3>الربح التقديري الصافي</h3><div class="val" style="color:var(--accent);">${netProfitEst.toLocaleString()} د.ع</div></div>
        </div>

        <div class="flex-gap" style="margin-top:15px;">
            <button class="btn btn-secondary" onclick="window.print();">🖨️ طباعة التقرير</button>
            <a href="/reports/export-csv" class="btn btn-success">📥 تصدير التقرير (CSV - Excel)</a>
            <a href="https://wa.me/?text=${encodeURIComponent(reportText)}" target="_blank" class="btn btn-whatsapp">📲 إرسال التقرير بالواتساب</a>
        </div>
    `;

    res.send(renderLayout('التقارير المالية', content, 'reports'));
});

// --- تصدير CSV ---
app.get('/reports/export-csv', (req, res) => {
    const db = loadDB();
    let csv = `رقم الفاتورة,التاريخ,النوع,الجهة,نوع المادة,الوحدة,الكمية,الإجمالي,الواصل\n`;

    db.invoices.forEach(i => {
        csv += `"${i.id}","${i.date}","بيع","${i.customerName}","${i.cementType}","${i.unit||'طن'}",${i.qty},${i.total},${i.paid}\n`;
    });

    db.purchases.forEach(p => {
        csv += `"${p.id}","${p.date}","شراء","${p.supplierName||'مجهز'}","${p.cementType}","${p.unit||'طن'}",${p.qty},${p.total},${p.paid}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=al_baraa_report.csv');
    res.send('\uFEFF' + csv);
});

// --- تشغيل السيرفر ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`================================================`);
    console.log(`🏢 سيرفر شركة البراء يعمل بنجاح على المنفذ: ${PORT}`);
    console.log(`🔗 افتح الرابط في المتصفح: http://localhost:${PORT}`);
    console.log(`================================================`);
});