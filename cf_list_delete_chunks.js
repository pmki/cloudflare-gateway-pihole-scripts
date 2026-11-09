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

async function deleteChunkLists() {
  console.log("🔍 Đang lấy danh sách các Filter Lists từ Cloudflare...");
  const result = await cloudflareAPI("/rules/lists");

  if (!result.success) {
    console.error("❌ Không thể lấy danh sách Lists:", result.errors);
    return;
  }

  // Lọc ra các list có tên bắt đầu bằng "CGPS List - Chunk "
  const listsToDelete = result.result.filter(list => list.name.startsWith(TARGET_PREFIX));

  if (listsToDelete.length === 0) {
    console.log(`✅ Không tìm thấy danh sách nào có tên bắt đầu bằng "${TARGET_PREFIX}".`);
    return;
  }

  console.log(`📂 Tìm thấy ${listsToDelete.length} danh sách cần xóa.`);

  for (const list of listsToDelete) {
    console.log(`⏳ Đang xóa: ${list.name} (ID: ${list.id})...`);
    const deleteResult = await cloudflareAPI(`/rules/lists/${list.id}`, "DELETE");

    if (deleteResult.success) {
      console.log(`✅ Đã xóa thành công: ${list.name}`);
    } else {
      const errorMsg = deleteResult.errors?.[0]?.message || "Lỗi không xác định";
      console.error(`❌ Thất bại khi xóa ${list.name}: ${errorMsg}`);
      console.error(`   👉 Mẹo: Hãy chắc chắn danh sách này đã được gỡ khỏi tất cả Gateway Rules.`);
    }
  }
  console.log("🏁 Hoàn thành tiến trình xóa các Chunk Lists.");
}

deleteChunkLists();
