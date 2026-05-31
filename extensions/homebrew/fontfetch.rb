# Homebrew Formula for fontfetch
#
# This file lives at extensions/homebrew/fontfetch.rb. To publish:
#   1. Create a new repository named `homebrew-fontfetch` under the
#      niyamvora GitHub account.
#   2. Copy this file to `Formula/fontfetch.rb` in that repo.
#   3. Update `url` and `sha256` for the current published version of
#      the npm tarball.
#   4. Users install with `brew install niyamvora/fontfetch/fontfetch`.
#
# Maintenance: when a new fontfetch version ships to npm, bump `url` and
# `sha256` here, then push to homebrew-fontfetch. Optional: wire a GitHub
# Action on the main fontfetch repo that opens a bump PR on every npm
# publish.

class Fontfetch < Formula
  desc "Download every web font from any site into a project-ready folder"
  homepage "https://github.com/niyamvora/fontfetch"
  url "https://registry.npmjs.org/fontfetch/-/fontfetch-1.4.0.tgz"
  sha256 "0000000000000000000000000000000000000000000000000000000000000000"
  license "MIT"
  version "1.4.0"

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    # Sanity check: the binary exists and reports its version.
    assert_match version.to_s, shell_output("#{bin}/fontfetch --version")
  end
end
