"""Curated starter guide. Prices/hours are indicative, not live business information."""
import json,pathlib
out=pathlib.Path(__file__).resolve().parents[1]/'public/offline'
rows=[
 ('dragon-bridge','Cầu Rồng','sightseeing','Hải Châu',108.2266,16.0611,'Cầu Rồng, đường Nguyễn Văn Linh','Biểu tượng bắc qua sông Hàn, phù hợp đi dạo và ngắm thành phố về đêm.','Cả ngày','Miễn phí','cau rong,rong,dragon bridge,song han,buoi toi'),
 ('han-bridge','Cầu sông Hàn','sightseeing','Hải Châu',108.2281,16.0721,'Cầu sông Hàn','Ngắm sông Hàn và những cây cầu từ trung tâm Đà Nẵng.','Cả ngày','Miễn phí','song han,cau quay,buoi toi'),
 ('my-khe','Biển Mỹ Khê','sightseeing','Sơn Trà',108.2469,16.0615,'Đường Võ Nguyên Giáp, Mỹ Khê','Bãi biển dài phía đông thành phố, thích hợp đi bộ buổi sớm.','Cả ngày','Miễn phí','bien my khe,beach,bien,tam bien,binh minh'),
 ('cham-museum','Bảo tàng Điêu khắc Chăm','sightseeing','Hải Châu',108.2231,16.0602,'2 đường 2 Tháng 9','Khám phá nghệ thuật và di sản điêu khắc Chăm bên bờ sông Hàn.','Tham khảo: 07:00–17:00','Tham khảo: 60.000đ','bao tang,van hoa,lich su,cham'),
 ('cathedral','Nhà thờ Chính tòa Đà Nẵng','sightseeing','Hải Châu',108.2209,16.0667,'156 Trần Phú','Nhà thờ màu hồng tại trung tâm; tôn trọng không gian sinh hoạt tôn giáo.','Theo lịch sinh hoạt của nhà thờ','Miễn phí','nha tho,check in,kien truc,hai chau'),
 ('han-market','Chợ Hàn','entertainment','Hải Châu',108.2236,16.0685,'119 Trần Phú','Khám phá đặc sản khô và quà lưu niệm trong khu chợ trung tâm.','Tham khảo: 06:00–19:00','Tùy mặt hàng','cho han,mua sam,dac san,qua luu niem'),
 ('con-market','Chợ Cồn','entertainment','Hải Châu',108.2149,16.0679,'290 Hùng Vương','Khu chợ với nhiều hàng ăn và đặc sản địa phương; giá tùy từng hàng.','Tham khảo: 07:00–18:00','Tùy gian hàng','cho con,mua sam,am thuc,an vat'),
 ('love-bridge','Cầu Tình Yêu','sightseeing','Sơn Trà',108.2301,16.0614,'Trần Hưng Đạo, An Hải','Lối đi bộ ven sông gần tượng Cá chép hóa rồng, nhìn về Cầu Rồng.','Cả ngày','Miễn phí','cau tinh yeu,cau rong,song han,buoi toi'),
 ('apec-park','Công viên APEC','sightseeing','Hải Châu',108.2229,16.0583,'Đường 2 Tháng 9','Không gian kiến trúc và đi bộ ven sông, gần Bảo tàng Chăm.','Cả ngày','Miễn phí','cong vien,apec,cau rong,song han'),
 ('marble-mountains','Ngũ Hành Sơn','sightseeing','Ngũ Hành Sơn',108.2632,16.0035,'Hòa Hải, Ngũ Hành Sơn','Quần thể núi đá và hang động phía nam thành phố; chuẩn bị giày phù hợp.','Tham khảo: 07:00–17:00','Tùy điểm tham quan','nui,ngu hanh son,non nuoc,hang dong'),
 ('non-nuoc','Biển Non Nước','sightseeing','Ngũ Hành Sơn',108.271,16.0049,'Đường Trường Sa, Hòa Hải','Bờ biển gần danh thắng Ngũ Hành Sơn.','Cả ngày','Miễn phí','bien non nuoc,beach,bien'),
 ('east-sea-park','Công viên Biển Đông','entertainment','Sơn Trà',108.2457,16.0705,'Võ Nguyên Giáp, Phước Mỹ','Quảng trường và không gian đi dạo sát bãi biển.','Cả ngày','Miễn phí','cong vien,bien my khe,bien,vui choi,buoi chieu'),
 ('sun-wheel','Công viên Châu Á','entertainment','Hải Châu',108.227,16.0366,'1 Phan Đăng Lưu','Khu vui chơi phía nam trung tâm; cần kiểm tra lịch hoạt động khi có mạng.','Lịch hoạt động thay đổi','Tùy trò chơi','vui choi,cong vien,giai tri,asia park,gia dinh'),
 ('helio','Khu ẩm thực Helio','entertainment','Hải Châu',108.2262,16.0339,'Đường 2 Tháng 9','Không gian ăn uống và hoạt động buổi tối; lịch hoạt động có thể thay đổi.','Cần kiểm tra lịch hoạt động','Tùy gian hàng','cho dem,helio,buoi toi,an vat,vui choi'),
 ('mi-ba-mua','Mì Quảng Bà Mua','food','Hải Châu',108.2191,16.0641,'19 Trần Bình Trọng','Gợi ý thử mì Quảng với rau sống và bánh tráng tại trung tâm.','Tham khảo: 07:00–21:00','Tham khảo: 35.000–70.000đ','mi quang,my quang,dac san,an sang,an trua,an toi'),
 ('mi-ba-vi','Mì Quảng Bà Vị','food','Hải Châu',108.2141,16.0617,'166 Lê Đình Dương','Mì Quảng truyền thống, thuận tiện ghé khi khám phá khu Hải Châu.','Tham khảo: 07:00–21:00','Tham khảo: 35.000–70.000đ','mi quang,my quang,dac san,an sang,an trua,an toi'),
 ('banh-xeo-ba-duong','Bánh xèo Bà Dưỡng','food','Hải Châu',108.2154,16.0585,'Kiệt 280/23 Hoàng Diệu','Bánh xèo và nem lụi; quán trong kiệt, đoạn cuối nên đi bộ.','Tham khảo: 09:00–21:00','Tham khảo: 40.000–100.000đ','banh xeo,nem lui,dac san,an toi,an trua,cau rong'),
 ('banh-trang-tran','Bánh tráng cuốn thịt heo Trần','food','Hải Châu',108.225,16.0716,'4 Lê Duẩn','Gợi ý món bánh tráng cuốn và mắm nêm đặc trưng Đà Nẵng.','Cần xác nhận khi có mạng','Tham khảo: 80.000–180.000đ','banh trang,thit heo,dac san,an trua,an toi'),
 ('bun-cha-ca','Bún chả cá Hờn','food','Hải Châu',108.2184,16.0772,'113/3 Nguyễn Chí Thanh','Món bún chả cá phù hợp bữa sáng hoặc bữa trưa tại trung tâm.','Tham khảo: 06:00–20:00','Tham khảo: 30.000–60.000đ','bun cha ca,dac san,an sang,an trua,an toi'),
 ('banh-mi','Bánh mì Bà Lan','food','Hải Châu',108.2164,16.0596,'62 Trưng Nữ Vương','Gợi ý bữa ăn nhẹ với bánh mì; gần khu Cầu Rồng.','Cần xác nhận khi có mạng','Tham khảo: 20.000–40.000đ','banh mi,an nhe,an toi,cau rong'),
 ('seafood','Khu hải sản Mân Thái','food','Sơn Trà',108.2455,16.0942,'Đường Hoàng Sa, Mân Thái','Khu vực tập trung hàng hải sản ven biển; hỏi giá trước khi gọi món.','Tùy từng quán','Theo món và thời giá','hai san,an toi,son tra,bien,man thai'),
 ('son-tra-night-market','Chợ đêm Sơn Trà','food','Sơn Trà',108.2311,16.0599,'Đường Lý Nam Đế, An Hải','Khu ẩm thực và hàng lưu niệm gần phía đông Cầu Rồng.','Tham khảo: 18:00–22:00','Tùy gian hàng','cho dem,an vat,an toi,cau rong,dac san,son tra'),
 ('cong-coffee','Cộng Cà Phê Bạch Đằng','food','Hải Châu',108.2241,16.0695,'96–98 Bạch Đằng','Gợi ý cà phê nhìn về phía sông Hàn khi đi dạo ở trung tâm.','Tham khảo: 07:00–23:00','Tham khảo: 35.000–75.000đ','ca phe,cafe,coffee,song han,buoi chieu,buoi toi'),
 ('long-coffee','Long Cà Phê','food','Hải Châu',108.2194,16.0732,'123 Lê Lợi','Cà phê địa phương tại khu trung tâm Hải Châu.','Tham khảo: 06:00–22:00','Tham khảo: 20.000–45.000đ','ca phe,cafe,coffee,buoi sang,buoi chieu'),
 ('an-thuong','Khu phố An Thượng','entertainment','Ngũ Hành Sơn',108.2465,16.0477,'Mỹ An, Ngũ Hành Sơn','Khu phố đi bộ và dịch vụ du lịch gần biển Mỹ Khê.','Cả ngày; đông hơn buổi tối','Tùy dịch vụ','an thuong,vui choi,di bo,bien my khe,buoi toi'),
 ('hoa-xuan','Công viên bờ sông Hòa Xuân','sightseeing','Cẩm Lệ',108.2289,16.0131,'Khu đô thị Hòa Xuân','Không gian đi bộ và ngắm sông phía nam trung tâm.','Cả ngày','Miễn phí','hoa xuan,cam le,cong vien,di bo,buoi chieu'),
 ('airport','Sân bay Đà Nẵng','sightseeing','Hải Châu',108.2027,16.0551,'Đường Duy Tân','Mốc xuất phát tại khu vực nhà ga; chú ý quy định ra vào sân bay.','Theo lịch bay','Tùy dịch vụ','san bay,airport,diem xuat phat'),
 ('station','Ga Đà Nẵng','sightseeing','Thanh Khê',108.2093,16.0717,'791 Hải Phòng','Mốc xuất phát tại ga đường sắt ở phía tây trung tâm.','Theo lịch tàu','Tùy hành trình','ga da nang,ga tau,diem xuat phat'),
]
places=[]
for r in rows:
 id,name,category,district,lng,lat,address,description,hours,price,tags=r
 places.append(dict(id=id,name=name,category=category,district=district,lng=lng,lat=lat,address=address,description=description,hours=hours,price=price,tags=tags.split(','),image=f'{category}.webp',imageKind='illustration',source='MapAI — bộ gợi ý tuyển chọn, tọa độ và thông tin tham khảo'))
(out/'places.json').write_text(json.dumps(places,ensure_ascii=False,separators=(',',':')))
# Simplified visual water/green features; routing exclusively uses OSM graph above.
features=[]
def polygon(kind,coords):
 features.append({'type':'Feature','properties':{'kind':kind},'geometry':{'type':'Polygon','coordinates':[coords+[coords[0]]]}})
polygon('water',[[108.33,15.97],[108.282,15.97],[108.271,16.01],[108.253,16.045],[108.245,16.067],[108.249,16.101],[108.264,16.119],[108.285,16.13],[108.33,16.13]])
polygon('water',[[108.216,15.97],[108.222,16.008],[108.235,16.033],[108.231,16.048],[108.228,16.065],[108.228,16.08],[108.22,16.098],[108.207,16.109],[108.206,16.115],[108.218,16.109],[108.233,16.096],[108.235,16.08],[108.233,16.064],[108.235,16.047],[108.24,16.032],[108.226,16.008],[108.221,15.97]])
polygon('park',[[108.26,16.12],[108.27,16.15],[108.32,16.16],[108.33,16.145],[108.31,16.12],[108.285,16.12]])
(out/'geography.json').write_text(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':')))
