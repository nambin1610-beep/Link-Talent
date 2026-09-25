/**
 * Rule phân loại song ngữ (VI/EN) — MVP, không dùng AI.
 * Mỗi rule là danh sách regex term; điểm = số term khớp. Marketer chỉnh từ điển tại đây.
 */

var ANGLE_RULES = {
  SPEED: ['nhanh', 'trong \\d+ ?(ngày|tuần|giờ)', '\\d+ ?(ngày|tuần)', 'shortlist', 'gấp', 'khẩn', 'ngay lập tức', 'fast', 'quick', 'within \\d+'],
  QUALITY_FIT: ['đúng người', 'phù hợp', 'chất lượng', 'năng lực', 'văn hóa', 'đánh giá', 'sàng lọc', 'right (person|people|talent)', 'culture fit', 'quality'],
  SENIOR_TALENT: ['cấp cao', 'c-level', 'ceo', 'cfo', 'cto', 'coo', 'chro', 'giám đốc', 'quản lý', 'trưởng phòng', 'lãnh đạo', 'executive', 'senior', 'leader', 'manager', 'director', 'head of'],
  NICHE_EXPERTISE: ['chuyên ngành', 'chuyên sâu', 'ngành (it|công nghệ|tài chính|ngân hàng|sản xuất|fmcg|bán lẻ|dược|bất động sản|logistics)', '\\bit\\b', 'tech', 'fintech', 'kỹ sư', 'engineer', 'specialist', 'industry'],
  PASSIVE_NETWORK: ['ứng viên thụ động', 'mạng lưới', 'kho ứng viên', 'cơ sở dữ liệu', 'database', 'network', 'passive candidate', 'không đăng tin', 'tiếp cận', 'talent pool', 'headhunt', 'săn đầu người', 'săn nhân tài'],
  GUARANTEE: ['bảo hành', 'thay thế miễn phí', 'cam kết', 'đảm bảo', 'hoàn phí', 'hoàn tiền', 'guarantee', 'replacement'],
  PRICING: ['phí', '% ?lương', 'chi phí', 'giá', 'chỉ trả (phí|tiền) khi', 'không thành công không', 'no cure no pay', 'fee', 'pricing', 'success fee', 'retainer'],
  CONFIDENTIAL: ['bảo mật', 'tuyển kín', 'kín đáo', 'thay thế nhân sự', 'confidential', 'discreet'],
  AI_TECH: ['\\bai\\b', 'trí tuệ nhân tạo', 'tự động', 'công nghệ', 'matching', 'thuật toán', 'machine learning', 'automation'],
  SOCIAL_PROOF: ['\\d[\\d.,]*\\+? ?(doanh nghiệp|khách hàng|đối tác|ứng viên|vị trí|năm kinh nghiệm)', 'tin dùng', 'tin tưởng', 'top \\d', 'hàng đầu', 'uy tín', 'giải thưởng', 'trusted', 'leading', 'award'],
  PAIN_FEAR: ['tuyển sai', 'nghỉ việc', 'bỏ trống', 'trống vị trí', 'mất ứng viên', 'khó tuyển', 'không tìm được', 'thiếu nhân sự', 'bad hire', 'turnover', 'vacancy'],
  OFFER_PROMO: ['miễn phí', 'giảm', 'ưu đãi', 'khuyến mãi', 'tặng', 'voucher', 'free', 'discount', 'offer'],
  EDUCATION: ['báo cáo', 'khảo sát', 'cẩm nang', 'hướng dẫn', 'xu hướng', 'bí quyết', 'salary (guide|report|survey)', 'mức lương thị trường', 'insight', 'guide', 'report'],
  EVENT: ['sự kiện', 'hội thảo', 'webinar', 'workshop', 'talkshow', 'meetup', 'event'],
  EMPLOYER_BRAND: ['thương hiệu tuyển dụng', 'employer brand', '\\bevp\\b', 'nơi làm việc tốt'],
  DATA_REPORTING: ['dashboard', 'số liệu', 'đo lường', 'báo cáo tiến độ', 'minh bạch', 'real-?time', 'data'],
  CANDIDATE_JOB: ['ứng tuyển', 'việc làm', 'cơ hội (nghề nghiệp|việc làm)', 'mức lương', 'thu nhập', 'gửi cv', 'nộp cv', 'we are hiring', 'apply', 'job opening', 'tuyển (gấp )?\\d+ ']
};

var PAIN_RULES = {
  SLOW_HIRING: ['tuyển (mãi|lâu|chậm)', 'mất (hàng tháng|nhiều tháng|nhiều tuần)', 'time[- ]to[- ]hire', 'chậm trễ', 'bỏ trống'],
  BAD_HIRE: ['tuyển sai', 'sai người', 'không phù hợp', 'bad hire', 'nghỉ việc sớm'],
  SENIOR_SCARCITY: ['khó tìm', 'khan hiếm', 'không tìm được', 'hiếm', 'cạnh tranh nhân tài', 'talent shortage'],
  LOW_QUALITY_CV: ['cv (rác|không chất lượng|ảo)', 'lọc cv', 'hàng trăm cv', 'ứng viên không đạt'],
  HR_OVERLOAD: ['quá tải', 'không đủ người', 'hr (bận|ít người)', 'thiếu thời gian'],
  HIGH_COST: ['tốn kém', 'chi phí cao', 'lãng phí', 'đắt', 'expensive'],
  CONFIDENTIALITY: ['bảo mật', 'tuyển kín', 'thay thế nhân sự', 'confidential'],
  RETENTION: ['giữ chân', 'nghỉ việc', 'turnover', 'retention', 'gắn bó']
};

var FUNNEL_RULES = {
  TOFU: ['xu hướng', 'bí quyết', 'mẹo', 'hướng dẫn', 'bạn có biết', 'báo cáo thị trường', 'infographic', 'blog', 'podcast', 'tips', 'guide', 'trend', 'what is', 'là gì'],
  MOFU: ['ebook', 'whitepaper', 'checklist', 'template', 'mẫu jd', 'webinar', 'workshop', 'hội thảo', 'case study', 'câu chuyện khách hàng', 'so sánh', '\\bvs\\b', 'báo cáo lương', 'salary guide', 'tìm hiểu dịch vụ'],
  BOFU: ['dùng thử', 'free trial', 'báo giá', 'bảng giá', 'pricing', 'đặt lịch', 'book a (demo|call|meeting)', 'tư vấn (miễn phí|1:1|ngay)', 'liên hệ ngay', 'gửi yêu cầu tuyển dụng', 'giảm \\d+ ?%', 'ưu đãi', 'chỉ còn', 'hôm nay', 'đăng ký ngay', 'get a quote']
};

var CTA_MAP = [
  ['BOOK_DEMO', /(đặt lịch|book (a )?(demo|call|meeting)|request (a )?demo|schedule)/i],
  ['FREE_TRIAL', /(dùng thử|try (it )?free|free trial|start (free|trial))/i],
  ['GET_QUOTE', /(báo giá|get (a )?quote|nhận giá)/i],
  ['REGISTER_EVENT', /(đăng ký tham (gia|dự)|register|giữ chỗ)/i],
  ['SIGN_UP', /(đăng ký|sign ?up|subscribe)/i],
  ['DOWNLOAD', /(tải|download)/i],
  ['CONTACT', /(liên hệ|contact|tư vấn|gửi yêu cầu)/i],
  ['APPLY_NOW', /(ứng tuyển|apply|nộp (hồ sơ|cv))/i],
  ['SEND_MESSAGE', /(gửi tin nhắn|nhắn tin|send message|message|whatsapp|zalo)/i],
  ['CALL', /(gọi ngay|call now|call)/i],
  ['SHOP_NOW', /(mua ngay|shop now|buy)/i],
  ['LEARN_MORE', /(tìm hiểu|xem thêm|learn more|see more|khám phá|visit|truy cập)/i]
];

function countTerms_(text, terms) {
  var n = 0;
  for (var i = 0; i < terms.length; i++) {
    if (new RegExp(terms[i], 'i').test(text)) n++;
  }
  return n;
}

function normalizeCta_(ctaText) {
  var t = str_(ctaText).trim();
  if (!t) return '';
  for (var i = 0; i < CTA_MAP.length; i++) if (CTA_MAP[i][1].test(t)) return CTA_MAP[i][0];
  return 'OTHER';
}

function detectAudience_(text, landingPath) {
  var t = str_(text).toLowerCase();
  var employer = countTerms_(t, ['nhà tuyển dụng', 'doanh nghiệp', '\\bhr\\b', 'nhân sự', 'tuyển dụng nhân sự', 'đăng tin', 'ứng viên phù hợp', '\\bats\\b', 'employer', 'hiring manager', 'headhunt', 'săn đầu người', 'dịch vụ tuyển dụng', 'tìm (người|nhân sự|ứng viên)', 'executive search', 'recruitment (service|agency|partner|solution)', 'talent acquisition', '(looking for|hiring) an? (ceo|cfo|cto|coo|chro|head|director|manager|leader)', 'shortlist', 'your (team|company|business)', 'doanh nghiệp của bạn', 'cho doanh nghiệp']);
  var candidate = countTerms_(t, ['việc làm', 'tìm việc', 'cv của bạn', 'ứng tuyển', 'mức lương', 'thu nhập', 'job seeker', 'apply', 'nộp cv', 'gửi cv', 'cơ hội nghề nghiệp', 'we are hiring']);
  if (/\/(employer|nha-tuyen-dung|recruiter|for-employers|clients?|doanh-nghiep)/i.test(str_(landingPath))) employer += 2;
  if (/\/(jobs?|viec-lam|job-seekers?|candidates?|ung-vien)/i.test(str_(landingPath))) candidate += 2;
  if (employer - candidate >= 1) return 'EMPLOYER';
  if (candidate - employer >= 1) return 'CANDIDATE';
  return 'UNKNOWN';
}

function classifyAngles_(text) {
  var t = str_(text).toLowerCase();
  var scored = Object.keys(ANGLE_RULES).map(function (k) { return [k, countTerms_(t, ANGLE_RULES[k])]; })
    .filter(function (x) { return x[1] > 0; })
    .sort(function (a, b) { return b[1] - a[1]; });
  if (!scored.length) return { primary: 'UNCLASSIFIED', secondary: [] };
  var top = scored[0][1];
  var secondary = scored.slice(1).filter(function (x) { return x[1] >= top / 2; }).slice(0, 2).map(function (x) { return x[0]; });
  return { primary: scored[0][0], secondary: secondary };
}

function classifyPain_(text) {
  var t = str_(text).toLowerCase();
  var best = 'NONE';
  var bestScore = 0;
  Object.keys(PAIN_RULES).forEach(function (k) {
    var s = countTerms_(t, PAIN_RULES[k]);
    if (s > bestScore) { best = k; bestScore = s; }
  });
  return best;
}

function classifyFunnel_(text, ctaNorm, landingPath) {
  var t = str_(text).toLowerCase();
  var p = str_(landingPath).toLowerCase();
  var tf = countTerms_(t, FUNNEL_RULES.TOFU) + (ctaNorm === 'LEARN_MORE' ? 2 : 0) + (/\/(blog|tin-tuc|cam-nang|news|insights?)/.test(p) ? 2 : 0);
  var mf = countTerms_(t, FUNNEL_RULES.MOFU) + (ctaNorm === 'DOWNLOAD' || ctaNorm === 'REGISTER_EVENT' ? 2 : 0) + (/\/(webinar|ebook|case-stud|salary|bao-cao|dich-vu|services?)/.test(p) ? 2 : 0);
  var bf = countTerms_(t, FUNNEL_RULES.BOFU) + (['BOOK_DEMO', 'FREE_TRIAL', 'GET_QUOTE', 'CONTACT', 'SIGN_UP'].indexOf(ctaNorm) >= 0 ? 3 : 0) + (/\/(pricing|bang-gia|lien-he|contact|dang-ky|demo|request)/.test(p) ? 2 : 0);
  var mx = Math.max(tf, mf, bf);
  if (mx === 0) return 'UNCLASSIFIED';
  if (bf === mx) return 'BOFU';
  if (mf === mx) return 'MOFU';
  return 'TOFU';
}

function detectFramework_(body) {
  var t = str_(body).toLowerCase();
  if (t.length < 60) return 'NONE';
  var head = t.slice(0, Math.max(80, Math.round(t.length / 3)));
  var tail = t.slice(-150);
  var p = /\?|bạn (đang|có|còn|vẫn)|mệt mỏi|mất (hàng|cả|quá|nhiều)|tốn|khó khăn|đau đầu|struggl|tired of|khó tuyển/.test(head);
  var a = /tuyển sai|rủi ro|thiệt hại|gấp \d|mất thêm|nghỉ việc|chậm trễ|bỏ trống|cost of|losing|lỡ mất/.test(t);
  var s = /giúp bạn|giải pháp|chỉ với|chỉ cần|hãy để|với dịch vụ|helps? you|with our|let us/.test(t);
  var bab = /(trước đây|trước khi|từng).{0,160}(giờ đây|sau khi|bây giờ|nay đã)|hãy tưởng tượng|imagine|không còn phải/.test(t);
  var sp = /\d[\d.,]*\+?\s*(doanh nghiệp|khách hàng|nhà tuyển dụng|ứng viên|vị trí|companies|clients|placements)|tin dùng|trusted by|★|top \d/.test(t);
  var aida = /^\d|\?|!/.test(head) && /dịch vụ|quy trình|tính năng|feature|mạng lưới|network/.test(t) &&
    /giúp|tiết kiệm|nhanh|hiệu quả|đúng người|save/.test(t) && /đăng ký|liên hệ|tư vấn|tìm hiểu|nhận ngay|book|sign up|contact/.test(tail);
  if (p && a && s) return 'PAS';
  if (bab) return 'BAB';
  if (aida) return 'AIDA';
  if (sp) return 'SOCIAL_PROOF';
  return 'OTHER';
}

function offerType_(text) {
  var t = str_(text).toLowerCase();
  if (/dùng thử|free trial/.test(t)) return 'FREE_TRIAL';
  if (/bảo hành|thay thế miễn phí|hoàn phí|hoàn tiền|guarantee|replacement/.test(t)) return 'GUARANTEE';
  if (/giảm|\d+\s?%\s?(off|giảm)|discount|khuyến mãi|voucher|ưu đãi/.test(t)) return 'DISCOUNT';
  if (/ebook|checklist|template|mẫu jd|tải miễn phí|báo cáo lương|salary (guide|report)|báo cáo miễn phí/.test(t)) return 'FREE_RESOURCE';
  if (/webinar|hội thảo|sự kiện|workshop|talkshow/.test(t)) return 'EVENT';
  if (/tư vấn miễn phí|free consultation|tư vấn 1:1/.test(t)) return 'FREE_CONSULTATION';
  if (/\bdemo\b/.test(t)) return 'DEMO';
  return 'NONE';
}

function extractOffer_(text) {
  var m = str_(text).match(/[^.!?\n]*(miễn phí|giảm|ưu đãi|bảo hành|hoàn phí|tặng|free|discount|guarantee)[^.!?\n]*/i);
  return m ? m[0].trim().slice(0, 200) : '';
}

function extractProof_(text) {
  var out = [];
  var re = /\d[\d.,]*\+?\s*(doanh nghiệp|khách hàng|đối tác|ứng viên|vị trí|năm kinh nghiệm|companies|clients|placements|years)/gi;
  var m;
  while ((m = re.exec(str_(text))) && out.length < 3) out.push(m[0].trim());
  if (/tin dùng|trusted by|giải thưởng|award|top \d/i.test(str_(text))) out.push('uy tín/giải thưởng');
  return out.join('; ');
}

function extractHook_(body) {
  var t = str_(body).trim();
  if (!t) return '';
  var m = t.match(/^[^.!?\n]{1,160}[.!?]?/);
  return (m ? m[0] : t.slice(0, 160)).trim();
}

/** Phân tích đầy đủ một bản ghi quảng cáo → cột *_auto của AD_ANALYSIS. */
function analyzeAd_(ad) {
  var body = str_(ad.body_text);
  var text = [body, ad.headline, ad.description, ad.cta_text].map(str_).join(' \n ');
  var landingPath = '';
  var lp = parseUrl_(ad.landing_url_raw || ad.landing_url);
  if (lp) landingPath = lp.path;
  var cta = ad.cta_normalized || normalizeCta_(ad.cta_text);
  var angles = classifyAngles_(text);
  return {
    hook_auto: extractHook_(body || ad.headline),
    pain_point_auto: classifyPain_(text),
    offer_auto: extractOffer_(text),
    offer_type_auto: offerType_(text),
    proof_auto: extractProof_(text),
    creative_angle_auto: angles.primary,
    secondary_angles_auto: angles.secondary.join(','),
    funnel_stage_auto: classifyFunnel_(text, cta, landingPath),
    framework_auto: detectFramework_(body),
    analysis_source: 'RULE'
  };
}

/** Giá trị hiệu lực: manual ưu tiên hơn auto. */
function effective_(row, field) {
  var manual = row[field + '_manual'];
  return isBlank_(manual) ? str_(row[field + '_auto']) : str_(manual);
}
