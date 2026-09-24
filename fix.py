with open('backend/index.js', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('return new RegExp(^https?://([^.]+\\\\.)*$);', 'return new RegExp(^https?://([^.]+\\\\.)*{escapedDomain}$);')
with open('backend/index.js', 'w', encoding='utf-8') as f:
    f.write(content)
