# move to langchain-docs directory
cd langchain-docs

# Download main documentation with limited recursion
wget -r -np -k -E -p --level=2 -A html \
  --user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" \
  https://js.langchain.com/docs/introduction/

# Download API reference
wget -r -np -k -E -p --level=1 \
  --user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" \
  https://v03.api.js.langchain.com/index.html

# Download API reference specific sections
wget -r -np -k -E -p --level=1 \
  --user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" \
  https://v03.api.js.langchain.com/classes/langchain.chains.APIChain.html

echo "✅ LangChain documentation downloaded recursively!"