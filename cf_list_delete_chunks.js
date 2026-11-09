const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;

if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
  console.error("❌ Thiếu biến môi trường CLOUDFLARE_API_TOKEN hoặc CLOUDFLARE_ACCOUNT_ID");
  process.exit(1);
}

// Tiền tố của các list cần xóa
const TARGET_PREFIX = "CGPS List - Chunk ";

async function cloudflareAPI(endpoint, method = "GET", body = null) {
  const options = {
    method,
    headers: {
      "Authorization": `Bearer ${CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`https://cloudflare.com{CF_ACCOUNT_ID}${endpoint}`, options);
  return await response.json();
}

async function getAllLists() {
  let allLists = [];
  let page = 1;
  let hasMore = true;

  console.log("🔍 Đang quét toàn bộ danh sách Filter Lists từ Cloudflare (hỗ trợ phân trang)...");

  while (hasMore) {
    // Gọi API kèm theo tham số phân trang page và per_page=100 (tối đa của Cloudflare)
    const result = await cloudflareAPI(`/rules/lists?page=${page}&per_page=100`);

    if (!result.success) {
      console.error(`❌ Không thể lấy danh sách ở trang ${page}:`, result.errors);
      break;
    }

    const lists = result.result || [];
    allLists = allLists.concat(lists);

    console.log(`📑 Đã quét trang ${page}: Lấy được ${lists.length} lists.`);

    // Kiểm tra xem còn trang tiếp theo không dựa vào thông tin result_info của Cloudflare
    if (result.result_info && result.result_info.page * result.result_info.per_page < result.result_info.total_count) {
      page++;
    } else {
      hasMore = false;
    }
  }

  return allLists;
}

async function deleteChunkLists() {
  const allLists = await getAllLists();

  // Lọc ra các list có tên bắt đầu bằng "CGPS List - Chunk "
  const listsToDelete = allLists.filter(list => list.name.startsWith(TARGET_PREFIX));

  if (listsToDelete.length === 0) {
    console.log(`✅ Hoàn thành: Không tìm thấy danh sách nào có tên bắt đầu bằng "${TARGET_PREFIX}".`);
    return;
  }

  console.log(`📂 Tìm thấy tổng cộng ${listsToDelete.length} danh sách trùng khớp cần xóa.`);

  for (const list of listsToDelete) {
    console.log(`⏳ Đang xóa: ${list.name} (ID: ${list.id})...`);
    const deleteResult = await cloudflareAPI(`/rules/lists/${list.id}`, "DELETE");

    if (deleteResult.success) {
      console.log(`  ✅ Đã xóa: ${list.name}`);
    } else {
      const errorMsg = deleteResult.errors?.[0]?.message || "Lỗi không xác định";
      console.error(`  ❌ Thất bại khi xóa ${list.name}: ${errorMsg}`);
    }
    
    // Giảm tải tần suất gọi API (Rate limit protection)
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  console.log("🏁 Đã chạy xong tiến trình dọn dẹp các Chunk Lists.");
}

deleteChunkLists();
