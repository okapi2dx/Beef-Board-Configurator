#include "../encoder_position.h"
#include <assert.h>
#include <stdio.h>

int main() {
  // Sensitivity 10: physical 1 count -> HID 1 count.
  EncoderPosition full;
  assert(full.get() == 127);
  for (int i = 1; i <= 20; ++i) {
    full.update(1, 10);
    assert(full.get() == 127 + i);
  }

  // Sensitivity 5: physical 2 counts -> HID 1 count.
  EncoderPosition half;
  half.update(1, 5); assert(half.get() == 127);
  half.update(1, 5); assert(half.get() == 128);
  half.update(1, 5); assert(half.get() == 128);
  half.update(1, 5); assert(half.get() == 129);

  // Sensitivity 1: physical 10 counts -> HID 1 count.
  EncoderPosition low;
  for (int i = 0; i < 9; ++i) { low.update(1, 1); assert(low.get() == 127); }
  low.update(1, 1); assert(low.get() == 128);

  // Reverse direction uses the same scale and wraps correctly.
  EncoderPosition reverse;
  reverse.update(-1, 10); assert(reverse.get() == 126);
  reverse.update(-1, 5);  assert(reverse.get() == 125);
  reverse.update(-1, 5);  assert(reverse.get() == 125);

  puts("PASS: neutral X=127; sensitivity 10=1:1, 5=1:2, 1=1:10");
}
