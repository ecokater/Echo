import os
import sys

# 物理路径加固：适配 PyInstaller 打包环境与开发环境
if getattr(sys, 'frozen', False):
    # 打包后的路径：.exe 所在的物理文件夹
    BASE_DIR = os.path.dirname(sys.executable)
else:
    # 开发环境路径：当前脚本所在的物理文件夹
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_DIR = os.path.join(BASE_DIR, "data")

# 确保数据目录存在（物理自动补全）
os.makedirs(DATA_DIR, exist_ok=True)

# 数据库：默认 SQLite（本地开发），生产经 DATABASE_URL 切 PostgreSQL
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{os.path.join(DATA_DIR, 'amber_memory.db')}",
)

# 鉴权 / JWT
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-prod-please")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))

# 商业化
SIGNUP_GIFT_FRAGMENTS = int(os.getenv("SIGNUP_GIFT_FRAGMENTS", "100"))
COST_PER_CHAT = int(os.getenv("COST_PER_CHAT", "1"))
COST_PER_DISTILL = int(os.getenv("COST_PER_DISTILL", "20"))
COST_PER_SNAPSHOT = int(os.getenv("COST_PER_SNAPSHOT", "5"))
LOW_BALANCE_THRESHOLD = int(os.getenv("LOW_BALANCE_THRESHOLD", "10"))

# 平台模型（主版本：服务端持有 key，客户端不带 key 时使用）
# 默认硅基流动 + DeepSeek。这些只用于首次播种 platform_config，运行后以数据库为准
# （管理员可在后台实时修改型号与单价）。
PLATFORM_API_KEY = os.getenv("PLATFORM_API_KEY", "")
PLATFORM_BASE_URL = os.getenv("PLATFORM_BASE_URL", "https://api.siliconflow.cn/v1")
PLATFORM_MODEL_ID = os.getenv("PLATFORM_MODEL_ID", "deepseek-ai/DeepSeek-V4-Pro")
