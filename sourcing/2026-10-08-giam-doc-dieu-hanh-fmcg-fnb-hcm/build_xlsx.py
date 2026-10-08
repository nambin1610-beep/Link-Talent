import json
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import CellIsRule
from openpyxl.utils import get_column_letter
from openpyxl.workbook.properties import CalcProperties
main=sorted(json.load(open('candidates.json')),key=lambda c:-c['fit_score'])
watch=json.load(open('watchlist_unverified.json')); excl=json.load(open('excluded_examples.json'))
rows=[["Chính",c['candidate_id'],c['full_name'],c['current_or_latest_title'],c['current_or_latest_company'],c['location'],c['logistics_forwarding_experience'],
       c['open_to_work_status'],c.get('open_to_work_evidence_date') or "không rõ",c['open_to_work_evidence'],c.get('open_to_work_source_url',''),c['fit_score'],
       "; ".join(c['missing_or_unverified_requirements']),c['linkedin_url']] for c in main]
rows+=[["Theo dõi",c['candidate_id'],c['full_name'],c['current_or_latest_title'],c['current_or_latest_company'],c['location'],c['snippet_evidence'],
        "unverified","","Chưa thấy tín hiệu tìm việc công khai","",None,"Cần hỏi trực tiếp nhu cầu chuyển việc",c['linkedin_url']] for c in watch]
F="Arial"; hdr=PatternFill("solid",fgColor="1F4E78"); inp=PatternFill("solid",fgColor="FFF2CC")
thin=Side(style="thin",color="BFBFBF"); bd=Border(left=thin,right=thin,top=thin,bottom=thin)
def sh(ws):
    for c in ws[1]:
        c.font=Font(name=F,bold=True,color="FFFFFF"); c.fill=hdr; c.alignment=Alignment(wrap_text=True,vertical="center",horizontal="center"); c.border=bd
def link(c):
    if c.value: c.hyperlink=c.value; c.font=Font(name=F,size=10,color="0563C1",underline="single")
wb=Workbook(); ws=wb.active; ws.title="Ứng viên"
ws.append(["STT","Nhóm","Mã","Họ tên","Chức danh","Công ty","Địa điểm","Kinh nghiệm điều hành FMCG/F&B","Open to Work","Ngày tín hiệu","Bằng chứng","URL bằng chứng","Điểm phù hợp","Điểm cần lưu ý","LinkedIn",
           "Đã liên hệ?","Ngày liên hệ","Kênh liên hệ","Phản hồi","Trạng thái công việc","Ghi chú của bạn"])
for i,r in enumerate(rows,1): ws.append([i]+r+["Chưa liên hệ",None,None,"Chưa phản hồi","Chưa xác minh",None])
n=len(rows)+1; sh(ws)
for row in ws.iter_rows(min_row=2,max_row=n):
    for c in row: c.font=Font(name=F,size=10); c.alignment=Alignment(wrap_text=True,vertical="top"); c.border=bd
    link(row[11]); link(row[14])
    for c in row[15:21]: c.fill=inp
    row[16].number_format="dd/mm/yyyy"
for i,w in enumerate([5,9,13,18,26,26,14,32,11,11,45,30,9,38,40,14,12,14,15,22,30],1): ws.column_dimensions[get_column_letter(i)].width=w
ws.freeze_panes="E2"; ws.auto_filter.ref=f"A1:U{n}"; ws.row_dimensions[1].height=32
def dv(o,rng):
    d=DataValidation(type="list",formula1='"'+",".join(o)+'"',allow_blank=True); ws.add_data_validation(d); d.add(rng)
dv(["Chưa liên hệ","Đã liên hệ","Không liên hệ được"],f"P2:P{n}")
dv(["LinkedIn InMail","LinkedIn kết nối","Email","Điện thoại/Zalo","Giới thiệu","Khác"],f"R2:R{n}")
dv(["Chưa phản hồi","Quan tâm","Không quan tâm","Hẹn phỏng vấn","Từ chối"],f"S2:S{n}")
dv(["Chưa xác minh","Đang tìm việc","Đang làm việc - mở cơ hội","Đang làm việc - không đổi việc","Đã nhận offer nơi khác"],f"T2:T{n}")
d=DataValidation(type="date",operator="greaterThan",formula1="DATE(2020,1,1)",allow_blank=True); ws.add_data_validation(d); d.add(f"Q2:Q{n}")
g=PatternFill("solid",fgColor="C6EFCE")
ws.conditional_formatting.add(f"P2:P{n}",CellIsRule(operator="equal",formula=['"Đã liên hệ"'],fill=g))
ws.conditional_formatting.add(f"T2:T{n}",CellIsRule(operator="equal",formula=['"Đang tìm việc"'],fill=g))
s=wb.create_sheet("Tổng hợp"); s.append(["Chỉ số","Giá trị"]); R="'Ứng viên'!"
for a,b in [("Tổng số hồ sơ (TP.HCM)",f"=COUNTA({R}D2:D{n})"),("Ứng viên chính (có tín hiệu tìm việc)",f'=COUNTIF({R}B2:B{n},"Chính")'),
 ("Open to Work confirmed",f'=COUNTIF({R}I2:I{n},"confirmed")'),("Open to Work probable",f'=COUNTIF({R}I2:I{n},"probable")'),
 ("Danh sách theo dõi",f'=COUNTIF({R}B2:B{n},"Theo dõi")'),("Đã liên hệ",f'=COUNTIF({R}P2:P{n},"Đã liên hệ")'),
 ("Chưa liên hệ",f'=COUNTIF({R}P2:P{n},"Chưa liên hệ")'),("Tỷ lệ đã liên hệ","=IFERROR(B7/B2,0)"),
 ("Phản hồi quan tâm",f'=COUNTIF({R}S2:S{n},"Quan tâm")'),("Hẹn phỏng vấn",f'=COUNTIF({R}S2:S{n},"Hẹn phỏng vấn")'),
 ("Trạng thái: Đang tìm việc",f'=COUNTIF({R}T2:T{n},"Đang tìm việc")'),("Trạng thái: Chưa xác minh",f'=COUNTIF({R}T2:T{n},"Chưa xác minh")')]: s.append([a,b])
s["B9"].number_format="0%"
for row in s.iter_rows():
    for c in row: c.font=Font(name=F,size=10); c.border=bd
sh(s); s.column_dimensions["A"].width=40; s.column_dimensions["B"].width=12
e=wb.create_sheet("Đã loại"); e.append(["Họ tên","LinkedIn","Lý do loại"])
for x in excl: e.append([x['name'],x['url'],x['reason']])
sh(e)
for row in e.iter_rows(min_row=2):
    for c in row: c.font=Font(name=F,size=10); c.alignment=Alignment(wrap_text=True,vertical="top"); c.border=bd
    link(row[1])
e.column_dimensions["A"].width=24; e.column_dimensions["B"].width=55; e.column_dimensions["C"].width=70
h=wb.create_sheet("Hướng dẫn")
for a,b in [("Cách dùng",""),("Ô nền vàng (cột P–U)","Bạn tự cập nhật, chọn từ danh sách thả xuống"),
 ("Ví dụ 1 dòng","Đã liên hệ | 29/09/2026 | LinkedIn InMail | Quan tâm | Đang tìm việc | Hẹn gọi 01/10"),
 ("Phạm vi","Giám đốc điều hành (CEO / GM / MD / COO / Operations Director) ngành FMCG và F&B tại TP.HCM. Địa điểm ghi 'Chưa xác minh' = cần hỏi lại ứng viên"),
 ("Nguồn","Apify harvestapi/linkedin-profile-search (chế độ Full, không email search) – 6 lượt tìm; kiểm tra 08/10/2026"),
 ("Open to Work","confirmed = cờ openToWork=true trên LinkedIn; probable = có tín hiệu nhưng chưa rõ ràng hoặc đã cũ; unverified = chưa thấy tín hiệu"),
 ("Chấm điểm (100)","OTW 20 · cấp Director/GM/C-level 25 · kinh nghiệm FMCG/F&B 20 · quy mô P&L/vận hành 15 · ở TP.HCM 10 · phù hợp khác 10. Thiếu dữ liệu = 0 điểm"),
 ("Giới tính","Không dùng tuổi, giới tính hay đặc điểm cá nhân để lọc hoặc chấm điểm")]: h.append([a,b])
for row in h.iter_rows():
    for c in row: c.font=Font(name=F,size=10); c.alignment=Alignment(wrap_text=True,vertical="top")
h["A1"].font=Font(name=F,bold=True,size=12); h.column_dimensions["A"].width=24; h.column_dimensions["B"].width=100
wb.calculation=CalcProperties(fullCalcOnLoad=True)
wb.save("ung-vien-giam-doc-dieu-hanh-fmcg-fnb-hcm.xlsx"); print(n-1,"rows")
