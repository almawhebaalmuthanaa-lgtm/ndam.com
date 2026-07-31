// Seed data for initial setup
const seedData = async () => {
  try {
    const User = require('../models/User');\n    const College = require('../models/College');
    const Department = require('../models/Department');
    const Student = require('../models/Student');
    
    // Clear existing data
    await User.deleteMany({});
    await College.deleteMany({});
    await Department.deleteMany({});
    
    // Create colleges
    const colleges = await College.insertMany([
      { collegeId: 'dentistry_college', name: 'كلية طب الأسنان', description: 'تأسست عام 2010' },
      { collegeId: 'pharmacy_college', name: 'كلية الصيدلة', description: 'تأسست عام 2012' },
      { collegeId: 'engineering_college', name: 'كلية الهندسة التقنية', description: 'تأسست عام 2015' },
      { collegeId: 'law_college', name: 'كلية القانون', description: 'تأسست عام 2011' },
      { collegeId: 'admin_college', name: 'كلية العلوم الإدارية', description: 'تأسست عام 2013' }
    ]);
    
    // Create departments
    const departments = await Department.insertMany([
      { departmentId: 'dentistry', name: 'طب الأسنان', college: colleges[0]._id, annualFee: 8000000, duration: 5 },
      { departmentId: 'pharmacy', name: 'الصيدلة', college: colleges[1]._id, annualFee: 7000000, duration: 5 },
      { departmentId: 'software-eng', name: 'هندسة البرمجيات', college: colleges[2]._id, annualFee: 3500000, duration: 4 },
      { departmentId: 'law', name: 'القانون', college: colleges[3]._id, annualFee: 2800000, duration: 4 },
      { departmentId: 'business', name: 'إدارة الأعمال', college: colleges[4]._id, annualFee: 1900000, duration: 4 }
    ]);
    
    // Create users
    const users = await User.insertMany([
      { fullName: 'مدير النظام', username: 'admin', password: 'admin123', role: 'admin' },
      { fullName: 'د. علي حسن', username: 'dept_dentistry', password: 'dent2026', role: 'dept_head', department: departments[0]._id },
      { fullName: 'د. سارة أحمد', username: 'dept_pharmacy', password: 'pharm2026', role: 'dept_head', department: departments[1]._id },
      { fullName: 'أحمد محمود - مدير التسجيل', username: 'registrar', password: 'reg2026', role: 'registrar' },
      { fullName: 'فاطمة علي - مديرة المالية', username: 'finance', password: 'fin2026', role: 'finance_manager' },
      { fullName: 'حاسبة 1', username: 'accounting1', password: 'acc2026', role: 'accounting', allowedIP: '192.168.1.100' },
      { fullName: 'حاسبة 2', username: 'accounting2', password: 'acc2026b', role: 'accounting', allowedIP: '192.168.1.101' },
      { fullName: 'كلية طب الأسنان', username: 'college_dentistry', password: 'col2026', role: 'college', college: colleges[0]._id },
      { fullName: 'كلية الصيدلة', username: 'college_pharmacy', password: 'col2026b', role: 'college', college: colleges[1]._id }
    ]);
    
    console.log('✅ Seed data created successfully');\n    console.log(`   - ${colleges.length} colleges`);\n    console.log(`   - ${departments.length} departments`);\n    console.log(`   - ${users.length} users`);\n  } catch (error) {
    console.error('❌ Error seeding data:', error.message);\n  }
};

module.exports = seedData;
