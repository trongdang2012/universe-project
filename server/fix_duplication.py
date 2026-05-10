import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('index.js', 'rb') as f:
    raw = f.read()

content = raw.decode('utf-8', errors='replace')

# 1. Update the robust regex for parsing grid cells
old_cell_logic = """          const blocks = cellText.split('Môn:').filter(b => b.trim() !== '');
          for (let block of blocks) {
            block = 'Môn:' + block;
            const monMatch = block.match(/Môn:\\s*(.+?)(?=\\n-Nhóm:|\\nNhóm:|-Nhóm:)/);
            const tietMatch = block.match(/Tiết:\\s*(.+?)(?=\\n-GV:|\\nGV:|-GV:|$)/);
            const gvMatch = block.match(/GV:\\s*(.+?)$/m);"""

new_cell_logic = """          const blocks = cellText.split('Môn:').filter(b => b.trim() !== '' && b.trim() !== '-');
          for (let block of blocks) {
            block = 'Môn:' + block;
            // Sử dụng regex đọc thẳng đến hết dòng, không phụ thuộc vào chuỗi phía sau
            const monMatch = block.match(/Môn:\\s*([^\\n\\r]+)/);
            const tietMatch = block.match(/Tiết:\\s*([^\\n\\r]+)/);
            const gvMatch = block.match(/GV:\\s*([^\\n\\r]+)/);"""

if old_cell_logic in content:
    content = content.replace(old_cell_logic, new_cell_logic)
    print("Fixed cell parsing regex")
else:
    print("Could not find old cell logic")


# 2. Update the syncQNUForUser to delete old format schedules to prevent duplication
old_sync_logic = """  // Xóa các lịch TRÙNG với những ngày trong tuần này (để tránh rác)
  await prisma.schedule.deleteMany({ 
    where: { 
      userId, 
      date: { in: dates } 
    } 
  });"""

new_sync_logic = """  // MIGRATION: Xoá toàn bộ lịch cũ lưu bằng format ISO 'YYYY-MM-DD' (có chứa dấu '-') gây trùng lặp
  await prisma.schedule.deleteMany({
    where: { userId, date: { contains: '-' } }
  });

  // Xóa các lịch TRÙNG với những ngày trong tuần này (để tránh rác)
  await prisma.schedule.deleteMany({ 
    where: { 
      userId, 
      date: { in: dates } 
    } 
  });"""

if old_sync_logic in content:
    content = content.replace(old_sync_logic, new_sync_logic)
    print("Fixed sync duplication logic")
else:
    print("Could not find old sync logic")

with open('index.js', 'w', encoding='utf-8') as f:
    f.write(content)

import subprocess
res = subprocess.run(['node', '-c', 'index.js'], capture_output=True, text=True)
print(f"Syntax: {res.returncode}")
if res.returncode != 0: print(res.stderr[:200])
