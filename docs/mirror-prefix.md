# 加速前缀（复制链接时自动拼接）

[← 返回 README](../README.md)

国内直连 `raw.githubusercontent.com` 经常不稳。配好之后，页面上勾选「加速前缀」，
复制出来的链接就会自动拼上前缀，直接粘进洛雪音乐即可。

## 配置

在 `config.json` 中设置，详见 [配置](configuration.md)：

```json
"mirror_prefixes": [
  {
    "name": "gh1.lhl.one",
    "prefix": "https://gh1.lhl.one/",
    "hosts": ["github.com", "githubusercontent.com", "github.io"]
  }
]
```

## 效果

```
原始  https://raw.githubusercontent.com/javon4016/xgzy-mysources/HEAD/墨澜聚合音源 v2.2.0.js
复制  https://gh1.lhl.one/https://raw.githubusercontent.com/javon4016/xgzy-mysources/HEAD/墨澜聚合音源 v2.2.0.js
```

## 字段说明

| 字段 | 说明 |
|---|---|
| `name` | 下拉里显示的名字，可省略（默认显示 prefix） |
| `prefix` | 拼在链接前面的字符串，**建议以 `/` 结尾** |
| `hosts` | 可选。只对匹配的域名生效，避免给 jsdelivr / gitee 链接套错前缀；留空 = 所有链接都拼 |

## 其他

- 只想配一个的话，可以简写成字符串：`"mirror_prefixes": ["https://gh1.lhl.one/"]`
- 配了多个时，工具栏会出现下拉框切换；开关状态和选择记在浏览器 localStorage，刷新后保持
- 「导出 TXT」同样按开关状态拼接前缀，导出范围为当前筛选后的列表
- 前缀服务由第三方提供，其可用性、稳定性与隐私风险请自行评估
